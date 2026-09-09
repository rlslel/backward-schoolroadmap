// 학교 공유 구글 시트에서 행사 확정일을 읽어 온다.
//
// 시트는 서버 대신 쓰는 공유 창고다. 앱은 읽기만 하고 절대 쓰지 않는다.
// 구글 로그인, API 키, 앱스스크립트를 쓰지 않는다. 「웹에 게시」로 공개된 CSV 주소만 읽는다.

import type { Anchor, SubTask, Task } from "../types";
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

export interface SheetTask {
  /** 시트에 적힌 업무 이름. 이 이름으로 id 를 만들기 때문에 이름을 바꾸면 새 업무가 된다. */
  name: string;
  date: string; // ISO
  dept: string;
}

export interface SheetParseResult {
  /** 이미 아는 업무의 확정일. 업무 id → ISO 날짜. */
  anchors: Record<string, string>;
  /** 시트에만 있는 업무. 학교가 새로 만든 행사다. */
  added: SheetTask[];
  /** 날짜 칸에 「없음」이라 적어 학교 전체에서 끈 업무의 id. */
  disabled: string[];
  /** 날짜를 읽지 못해 건너뛴 줄 수. */
  invalidRows: number;
  /** 읽어들인 데이터 줄 수 (머리글 제외). */
  totalRows: number;
}

const EMPTY_RESULT: SheetParseResult = {
  anchors: {},
  added: [],
  disabled: [],
  invalidRows: 0,
  totalRows: 0,
};

/** 날짜 칸에 이렇게 적으면 「우리 학교는 이 업무를 하지 않는다」는 뜻이다. */
export const OFF_LABELS = ["없음", "해당없음", "해당 없음", "미실시", "안함", "-", "X"] as const;
const OFF_VALUES: string[] = [...OFF_LABELS, "안 함", "–", "x"];

function isOffValue(text: string): boolean {
  return OFF_VALUES.includes(text.trim());
}

/**
 * 업무 이름을 견주기 좋게 다듬는다.
 * 부장이 「가을 운동회」를 「가을운동회」로 적거나 앞뒤에 공백이 붙어도 같은 것으로 본다.
 */
export function normalizeTitle(text: string): string {
  return text.replace(/\s+/g, "").trim();
}

/** 시트에만 있는 업무의 id. 이름이 같으면 항상 같은 id 라서 체크 표시가 유지된다. */
export function sheetTaskId(name: string): string {
  return `sheet-${normalizeTitle(name)}`;
}

export interface TaskLookup {
  ids: ReadonlySet<string>;
  /** 다듬은 업무 이름 → 업무 id */
  byTitle: ReadonlyMap<string, string>;
}

/**
 * 시트 첫 칸에 무엇이 적혀 있든 업무를 찾을 수 있게 표를 만든다.
 * 부장은 「가을 운동회」라고 적는다. `sports-day` 같은 영문 id 를 손으로 치게 하면 안 된다.
 */
export function buildTaskLookup(tasks: Task[]): TaskLookup {
  const ids = new Set<string>();
  const byTitle = new Map<string, string>();
  for (const task of tasks) {
    ids.add(task.id);
    byTitle.set(normalizeTitle(task.title), task.id);
  }
  return { ids, byTitle };
}

/** 시트 첫 칸의 값으로 업무 id 를 찾는다. 업무 이름과 영문 id 를 모두 받아들인다. */
function findTaskId(cell: string, lookup: TaskLookup): string | undefined {
  const raw = cell.trim();
  if (lookup.ids.has(raw)) return raw;
  return lookup.byTitle.get(normalizeTitle(raw));
}

/** 첫 줄이 머리글인지 본다. 업무도 아니고 날짜도 아니면 머리글로 본다. */
function isHeaderRow(row: string[], lookup: TaskLookup): boolean {
  const first = (row[0] ?? "").trim();
  const date = (row[1] ?? "").trim();
  if (first === "") return true;
  if (findTaskId(first, lookup) !== undefined) return false;
  return parseFlexibleDate(date) === null && !isOffValue(date);
}

/**
 * 시트를 읽는다. 시트가 학교 일정의 원본이다.
 *
 * - 아는 업무 이름 + 날짜 → 그 업무의 확정일을 덮어쓴다
 * - 모르는 업무 이름 + 날짜 → **학교가 새로 만든 행사로 본다.** 기본 준비 절차를 붙여 만든다
 * - 날짜 칸이 「없음」 → **학교 전체에서 그 업무를 끈다**
 * - 그 외 읽을 수 없는 줄 → 그 줄만 건너뛴다
 *
 * 모르는 이름을 그냥 버리면, 부장이 시트에 새 행사를 적어도 아무에게도 보이지 않는다.
 * 그러면 학교가 함께 쓰는 수단으로서 시트가 무의미해진다.
 */
export function parseSheet(csvText: string, lookup: TaskLookup): SheetParseResult {
  const rows = dropEmptyRows(parseCsv(csvText));
  if (rows.length === 0) return EMPTY_RESULT;

  const body = isHeaderRow(rows[0], lookup) ? rows.slice(1) : rows;

  const anchors: Record<string, string> = {};
  const added: SheetTask[] = [];
  const disabled: string[] = [];
  let invalidRows = 0;

  for (const row of body) {
    const label = (row[0] ?? "").trim();
    const dateText = (row[1] ?? "").trim();
    const dept = (row[2] ?? "").trim();
    if (label === "") continue;

    const known = findTaskId(label, lookup);

    if (isOffValue(dateText)) {
      const id = known ?? sheetTaskId(label);
      if (!disabled.includes(id)) disabled.push(id);
      continue;
    }

    const date = parseFlexibleDate(dateText);
    if (!date) {
      invalidRows += 1; // 날짜 칸이 비었거나 형식이 틀린 줄
      continue;
    }

    if (known) {
      anchors[known] = toISO(date); // 같은 업무가 여러 줄이면 마지막 값이 남는다
    } else {
      const id = sheetTaskId(label);
      const 이미 = added.findIndex((t) => sheetTaskId(t.name) === id);
      const entry = { name: label, date: toISO(date), dept: dept || "공통" };
      if (이미 >= 0) added[이미] = entry;
      else added.push(entry);
    }
  }

  return { anchors, added, disabled, invalidRows, totalRows: body.length };
}

/**
 * 학교에 나눠 줄 시트 서식을 만든다.
 * 업무 이름을 미리 채워 두어 부장은 날짜 칸만 채우면 되게 한다. 이름을 손으로 치지 않으니
 * 오타로 줄이 통째로 무시되는 일이 없다.
 */
export function buildSheetTemplate(tasks: Task[]): string {
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  // 부서까지 미리 채워 둔다. 부장은 날짜 칸만 채우면 된다.
  const lines = ["업무,확정일,부서"];
  for (const task of tasks) lines.push(`${escape(task.title)},,${escape(task.dept)}`);
  return lines.join("\r\n");
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
  validTaskIds: TaskLookup;
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

/**
 * 시트가 정한 확정일 전부. 시트에만 있는 업무도 포함한다.
 * 이걸 빼면 시트에서 온 업무가 화면에 「기본 제안일」로 잘못 표시된다.
 */
export function allSheetAnchors(result: SheetParseResult): Record<string, string> {
  const anchors = { ...result.anchors };
  for (const t of result.added) anchors[sheetTaskId(t.name)] = t.date;
  return anchors;
}

/** 시트에만 있는 업무를 앱이 쓰는 모양으로 바꾼다. 준비 절차는 기본값을 붙인다. */
export function sheetTasksToTasks(added: SheetTask[], defaultSubtasks: SubTask[]): Task[] {
  return added.map((t) => ({
    id: sheetTaskId(t.name),
    title: t.name,
    category: "custom" as const,
    dept: t.dept,
    anchor: { mode: "date" as const, date: t.date },
    enabled: true,
    subtasks: defaultSubtasks.map((s) => ({ ...s })),
  }));
}

/** 사용자에게 알릴 만한 문제가 있으면 한 줄로 만든다. */
export function sheetIssueNotice(result: SheetParseResult): string | undefined {
  if (result.invalidRows === 0) return undefined;
  return `시트에서 날짜를 읽지 못한 ${result.invalidRows}줄을 건너뛰었습니다.`;
}

/** 시트가 무엇을 했는지 알려 준다. 조용히 바뀌면 사용자는 앱이 고장 난 줄 안다. */
export function sheetChangeNotice(result: SheetParseResult): string | undefined {
  const parts: string[] = [];
  if (result.added.length > 0) parts.push(`시트에만 있는 업무 ${result.added.length}건을 기본 준비 절차로 만들었습니다`);
  if (result.disabled.length > 0) parts.push(`「없음」으로 적힌 업무 ${result.disabled.length}건을 껐습니다`);
  return parts.length === 0 ? undefined : `${parts.join(". ")}.`;
}

// ── 시드 · 시트 · 사용자 수정 합치기 ──────────────────────────────

export type AnchorSource = "seed" | "sheet" | "user";

export interface EffectiveAnchor {
  anchor: Anchor;
  source: AnchorSource;
  /**
   * 사용자가 앱에서 고쳐 두었지만, 학교 일정이 우선하므로 지금은 쓰이지 않는 값.
   * 조용히 없애지 않고 화면에서 알려 주는 데 쓴다. 시트에서 그 줄이 빠지면 다시 살아난다.
   */
  ignoredUserAnchor?: Anchor;
}

/**
 * 우선순위: 시트(학교 확정일) > 사용자가 직접 고친 값 > 시드(임시 배치).
 *
 * 시트를 가장 앞에 두는 이유는 부장이 학교 전체 사정을 알고 정한 날짜이기 때문이다.
 * 개인이 고쳐 둔 값 때문에 학교 확정일을 못 보게 되면, 여러 사람이 같은 일정을 본다는
 * 이 앱의 목적 자체가 무너진다.
 *
 * 다만 사용자가 고쳐 둔 값을 지우지는 않는다. `ignoredUserAnchor` 로 돌려주어
 * 화면에서 알릴 수 있게 하고, 시트에서 그 업무가 빠지면 자동으로 다시 쓰인다.
 */
export function effectiveAnchor(
  task: Task,
  userAnchor: Anchor | undefined,
  sheetAnchors: Record<string, string>,
): EffectiveAnchor {
  const sheetDate = sheetAnchors[task.id];

  if (sheetDate) {
    return {
      anchor: { mode: "date", date: sheetDate },
      source: "sheet",
      ignoredUserAnchor: userAnchor,
    };
  }

  if (userAnchor) return { anchor: userAnchor, source: "user" };
  return { anchor: task.anchor, source: "seed" };
}

/**
 * 어느 시트 주소를 쓸지 정한다. 링크로 들어온 주소가 저장된 주소를 이긴다.
 *
 * 학교가 시트를 새로 만들면 부장이 새 링크를 뿌린다. 그때 저장된 옛 주소가 이기면
 * 새 링크를 눌러도 옛날 시트를 계속 보게 된다.
 */
export function pickSheetUrl(hash: string, stored: string | undefined): string | undefined {
  const fromHash = readSheetUrlFromHash(hash);
  if (fromHash) return fromHash;
  if (stored && isAllowedSheetUrl(stored)) return stored;
  return undefined;
}
