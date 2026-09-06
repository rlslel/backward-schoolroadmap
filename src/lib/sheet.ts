// 학교 공유 구글 시트에서 행사 확정일을 읽어 온다.
//
// 시트는 서버 대신 쓰는 공유 창고다. 앱은 읽기만 하고 절대 쓰지 않는다.
// 구글 로그인, API 키, 앱스스크립트를 쓰지 않는다. 「웹에 게시」로 공개된 CSV 주소만 읽는다.

import type { Anchor, Task } from "../types";
import { parseFlexibleDate, toISO } from "./dates";
import { dropEmptyRows, parseCsv } from "./csv";
import type { StorageLike } from "./storage";

export const SHEET_CACHE_KEY = "backward-schoolroadmap::sheet";

/**
 * 읽어도 되는 주소인지 확인한다.
 * 시트 주소는 링크에 실려 여기저기 돌아다닌다. 아무 주소나 받아 읽으면
 * 누군가 링크를 조작해 앱이 엉뚱한 곳에 요청을 보내게 만들 수 있다.
 * 그래서 구글 시트 주소만 허용한다.
 */
export function isAllowedSheetUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" && u.hostname === "docs.google.com";
  } catch {
    return false;
  }
}

// ── 링크로 시트 주소 전달하기 ──────────────────────────────────────
// 부장이 링크 한 번만 뿌리면 나머지 교직원은 설정할 것이 없어야 한다.

/** 주소창의 `#s=...` 에서 시트 주소를 꺼낸다. 허용되지 않은 주소는 무시한다. */
export function readSheetUrlFromHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const value = params.get("s");
  if (!value) return null;

  const decoded = safeDecode(value);
  return isAllowedSheetUrl(decoded) ? decoded : null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 전 교직원에게 뿌릴 링크를 만든다. */
export function buildShareLink(appUrl: string, sheetUrl: string): string {
  const base = appUrl.split("#")[0];
  return `${base}#s=${encodeURIComponent(sheetUrl)}`;
}

// ── 시트 내용 해석 ────────────────────────────────────────────────

export interface SheetParseResult {
  /** 업무 id → 확정일(ISO). 시드의 기본 날짜를 덮어쓴다. */
  anchors: Record<string, string>;
  /** 시트에 있는데 앱에는 없는 업무 id. 조용히 무시하되 개수는 알린다. */
  unknownIds: string[];
  /** 날짜를 읽지 못해 건너뛴 줄 수. */
  invalidRows: number;
  /** 읽어들인 데이터 줄 수 (머리글 제외). */
  totalRows: number;
}

const EMPTY_RESULT: SheetParseResult = { anchors: {}, unknownIds: [], invalidRows: 0, totalRows: 0 };

/** 첫 줄이 머리글인지 본다. 업무 id 도 아니고 날짜도 아니면 머리글로 본다. */
function isHeaderRow(row: string[], validTaskIds: ReadonlySet<string>): boolean {
  const id = (row[0] ?? "").trim();
  const date = (row[1] ?? "").trim();
  return !validTaskIds.has(id) && parseFlexibleDate(date) === null;
}

/**
 * CSV 를 업무 id → 확정일로 바꾼다.
 * 한 줄에 오타가 있어도 그 줄만 건너뛰고 나머지는 정상 처리한다.
 */
export function parseSheet(csvText: string, validTaskIds: ReadonlySet<string>): SheetParseResult {
  const rows = dropEmptyRows(parseCsv(csvText));
  if (rows.length === 0) return EMPTY_RESULT;

  const body = isHeaderRow(rows[0], validTaskIds) ? rows.slice(1) : rows;

  const anchors: Record<string, string> = {};
  const unknownIds: string[] = [];
  let invalidRows = 0;

  for (const row of body) {
    const taskId = (row[0] ?? "").trim();
    const dateText = (row[1] ?? "").trim();
    if (taskId === "") continue;

    if (!validTaskIds.has(taskId)) {
      if (!unknownIds.includes(taskId)) unknownIds.push(taskId);
      continue;
    }

    const date = parseFlexibleDate(dateText);
    if (!date) {
      invalidRows += 1; // 날짜 칸이 비었거나 형식이 틀린 줄
      continue;
    }

    anchors[taskId] = toISO(date); // 같은 id 가 여러 줄이면 마지막 값이 남는다
  }

  return { anchors, unknownIds, invalidRows, totalRows: body.length };
}

// ── 시트 가져오기 ─────────────────────────────────────────────────

export type SheetStatus =
  | "none" // 시트 주소가 없다. 시드 기본값으로만 동작한다
  | "ok" // 방금 읽어 왔다
  | "cached" // 못 읽어서 지난번에 받아 둔 내용을 쓴다
  | "failed" // 못 읽었고 받아 둔 것도 없다
  | "blocked"; // 허용되지 않은 주소다

export interface SheetCache {
  url: string;
  csv: string;
  fetchedAt: string; // ISO
}

export interface SheetLoadResult extends SheetParseResult {
  status: SheetStatus;
  notice?: string;
  /** 화면에 「○월 ○일에 불러온 일정입니다」로 쓸 값. */
  fetchedAt?: string;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * 브라우저가 예전 내용을 기억해 두면, 부장이 시트를 고쳤는데도 옛날 날짜가 보인다.
 * 그러면 이 앱은 신뢰를 잃는다. 캐시를 두 겹으로 막는다.
 */
function withCacheBuster(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_=${Date.now()}`;
}

export async function fetchSheetCsv(url: string, fetchImpl: FetchLike): Promise<string> {
  const response = await fetchImpl(withCacheBuster(url), {
    cache: "no-store",
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`시트를 불러오지 못했습니다 (${response.status})`);
  return await response.text();
}

function readCache(storage: StorageLike | null, url: string): SheetCache | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SHEET_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as SheetCache).csv !== "string" ||
      (parsed as SheetCache).url !== url
    ) {
      return null;
    }
    return parsed as SheetCache;
  } catch {
    return null;
  }
}

function writeCache(storage: StorageLike | null, cache: SheetCache): void {
  if (!storage) return;
  try {
    storage.setItem(SHEET_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 저장이 막힌 브라우저에서는 캐시를 포기한다. 앱은 계속 돈다.
  }
}

export function clearSheetCache(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(SHEET_CACHE_KEY);
  } catch {
    // 지우지 못해도 할 수 있는 일이 없다
  }
}

/** 화면에 보여줄 날짜. "9월 6일" */
function formatFetchedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export interface LoadSheetOptions {
  url: string | undefined;
  validTaskIds: ReadonlySet<string>;
  fetchImpl: FetchLike;
  storage: StorageLike | null;
  now?: Date;
}

/**
 * 시트를 읽어 확정일을 돌려준다.
 * 어떤 경우에도 예외를 던지지 않는다. 시트를 못 읽어도 앱은 시드 기본값으로 정상 동작해야 한다.
 */
export async function loadSheet(options: LoadSheetOptions): Promise<SheetLoadResult> {
  const { url, validTaskIds, fetchImpl, storage, now = new Date() } = options;

  if (!url || url.trim() === "") return { ...EMPTY_RESULT, status: "none" };

  if (!isAllowedSheetUrl(url)) {
    return {
      ...EMPTY_RESULT,
      status: "blocked",
      notice: "구글 시트 주소가 아니어서 불러오지 않았습니다. 기본 일정으로 표시 중입니다.",
    };
  }

  try {
    const csv = await fetchSheetCsv(url, fetchImpl);
    const fetchedAt = now.toISOString();
    writeCache(storage, { url, csv, fetchedAt });
    return { ...parseSheet(csv, validTaskIds), status: "ok", fetchedAt };
  } catch {
    const cache = readCache(storage, url);
    if (cache) {
      return {
        ...parseSheet(cache.csv, validTaskIds),
        status: "cached",
        fetchedAt: cache.fetchedAt,
        notice: `학교 일정을 새로 불러오지 못해 ${formatFetchedAt(cache.fetchedAt)}에 받아 둔 내용을 보여 드립니다.`,
      };
    }
    return {
      ...EMPTY_RESULT,
      status: "failed",
      notice: "학교 일정을 불러오지 못했습니다. 기본 일정으로 표시 중입니다.",
    };
  }
}

/** 사용자에게 알릴 만한 문제가 있으면 한 줄로 만든다. */
export function sheetIssueNotice(result: SheetParseResult): string | undefined {
  const parts: string[] = [];
  if (result.invalidRows > 0) parts.push(`날짜를 읽지 못한 ${result.invalidRows}줄`);
  if (result.unknownIds.length > 0) parts.push(`앱에 없는 업무 ${result.unknownIds.length}건`);
  if (parts.length === 0) return undefined;
  return `시트에서 ${parts.join("과 ")}을 건너뛰었습니다.`;
}

// ── 시드 · 시트 · 사용자 수정 합치기 ──────────────────────────────

export type AnchorSource = "seed" | "sheet" | "user";

export interface EffectiveAnchor {
  anchor: Anchor;
  source: AnchorSource;
  /** 사용자가 학교 일정과 다르게 고쳐 둔 경우, 학교 일정 값. 화면에서 알려 주는 데 쓴다. */
  sheetAnchor?: Anchor;
}

/**
 * 우선순위: 사용자가 직접 고친 값 > 시트(학교 확정일) > 시드(임시 배치).
 *
 * 사용자 수정을 시트보다 앞에 두는 이유는, 앱에서 방금 고친 날짜가 새로고침하면
 * 되돌아가 버리는 것이 더 나쁘기 때문이다. 대신 학교 일정과 달라진 경우
 * `sheetAnchor` 로 알려서 조용히 어긋난 채로 두지 않는다.
 */
export function effectiveAnchor(
  task: Task,
  userAnchor: Anchor | undefined,
  sheetAnchors: Record<string, string>,
): EffectiveAnchor {
  const sheetDate = sheetAnchors[task.id];
  const sheetAnchor: Anchor | undefined = sheetDate ? { mode: "date", date: sheetDate } : undefined;

  if (userAnchor) return { anchor: userAnchor, source: "user", sheetAnchor };
  if (sheetAnchor) return { anchor: sheetAnchor, source: "sheet" };
  return { anchor: task.anchor, source: "seed" };
}
