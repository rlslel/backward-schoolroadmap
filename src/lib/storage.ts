// localStorage 래퍼. 저장이 막히거나 내용이 깨져 있어도 앱이 죽지 않는 것이 목표다.
// 학교 PC의 브라우저 정책이나 시크릿 모드에서는 저장 자체가 막힐 수 있다.

import { SCHEMA_VERSION, type Store, type Task, type UiState } from "../types";

export const STORAGE_KEY = "backward-schoolroadmap";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 저장이 막힌 환경에서 쓰는 대체 저장소. 새로고침하면 사라진다. */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

/** 실제로 쓸 수 있는 localStorage 를 돌려준다. 못 쓰면 null. */
export function detectStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage as StorageLike | undefined;
    if (!s) return null;
    const probe = `${STORAGE_KEY}::probe`;
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function defaultUi(): UiState {
  return { dept: "전체", grade: "all", category: "all", month: "all" };
}

export function createEmptyStore(schoolYear: number): Store {
  return {
    v: SCHEMA_VERSION,
    schoolYear,
    overrides: {},
    customTasks: [],
    checks: {},
    ui: defaultUi(),
  };
}

export type LoadStatus =
  | "ok" // 저장된 내용을 정상적으로 읽음
  | "empty" // 처음 실행
  | "reset" // 버전이 다르거나 내용이 깨져서 초기화함
  | "unavailable"; // 이 브라우저에서 저장 자체가 안 됨

export interface LoadResult {
  store: Store;
  status: LoadStatus;
  /** 사용자에게 보여줄 안내. 없으면 아무 말도 하지 않는다. */
  notice?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 저장된 내용을 믿지 않고 하나씩 확인한다. 깨진 부분은 기본값으로 되돌린다. */
function coerce(raw: unknown, schoolYear: number): Store | null {
  if (!isRecord(raw)) return null;
  if (raw.v !== SCHEMA_VERSION) return null;

  const ui = isRecord(raw.ui) ? raw.ui : {};
  const grade = ui.grade;
  const month = ui.month;

  return {
    v: SCHEMA_VERSION,
    schoolYear: typeof raw.schoolYear === "number" ? raw.schoolYear : schoolYear,
    overrides: isRecord(raw.overrides) ? (raw.overrides as Store["overrides"]) : {},
    customTasks: Array.isArray(raw.customTasks) ? (raw.customTasks as Task[]) : [],
    sheetUrl: typeof raw.sheetUrl === "string" ? raw.sheetUrl : undefined,
    checks: isRecord(raw.checks) ? (raw.checks as Record<string, boolean>) : {},
    ui: {
      dept: typeof ui.dept === "string" ? ui.dept : "전체",
      grade: typeof grade === "number" || grade === "all" ? grade : "all",
      category: typeof ui.category === "string" ? (ui.category as UiState["category"]) : "all",
      month: typeof month === "number" || month === "all" ? month : "all",
    },
  };
}

export function loadStore(storage: StorageLike | null, schoolYear: number): LoadResult {
  const fallback = createEmptyStore(schoolYear);

  if (!storage) {
    return {
      store: fallback,
      status: "unavailable",
      notice: "이 브라우저에서는 저장이 되지 않아 새로고침하면 내용이 사라집니다.",
    };
  }

  let text: string | null = null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return {
      store: fallback,
      status: "unavailable",
      notice: "이 브라우저에서는 저장이 되지 않아 새로고침하면 내용이 사라집니다.",
    };
  }

  if (text === null) return { store: fallback, status: "empty" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      store: fallback,
      status: "reset",
      notice: "저장된 내용을 읽지 못해 처음 상태로 되돌렸습니다.",
    };
  }

  const store = coerce(parsed, schoolYear);
  if (!store) {
    return {
      store: fallback,
      status: "reset",
      notice: "앱이 새 버전으로 바뀌어 저장된 내용을 처음 상태로 되돌렸습니다.",
    };
  }

  return { store, status: "ok" };
}

/** 저장 실패는 앱을 멈추지 않는다. 성공 여부만 돌려준다. */
export function saveStore(storage: StorageLike | null, store: Store): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function clearStore(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // 지우지 못해도 할 수 있는 일이 없다
  }
}

export interface PruneResult {
  store: Store;
  droppedChecks: number;
  droppedOverrides: number;
}

/**
 * 시드에서 사라진 업무에 걸려 있던 체크·수정 내용을 정리한다.
 * 조용히 사라지는 것이 가장 나쁘므로 버린 개수를 함께 돌려준다.
 */
export function pruneStore(
  store: Store,
  validTaskIds: ReadonlySet<string>,
  validCheckKeys: ReadonlySet<string>,
): PruneResult {
  const checks: Record<string, boolean> = {};
  let droppedChecks = 0;
  for (const [key, value] of Object.entries(store.checks)) {
    if (validCheckKeys.has(key)) checks[key] = value;
    else if (value) droppedChecks += 1; // 완료 표시였던 것만 센다
  }

  const overrides: Store["overrides"] = {};
  let droppedOverrides = 0;
  for (const [taskId, value] of Object.entries(store.overrides)) {
    if (validTaskIds.has(taskId)) overrides[taskId] = value;
    else droppedOverrides += 1;
  }

  return { store: { ...store, checks, overrides }, droppedChecks, droppedOverrides };
}

export function pruneNotice(result: PruneResult): string | undefined {
  const { droppedChecks, droppedOverrides } = result;
  if (droppedChecks === 0 && droppedOverrides === 0) return undefined;
  const parts: string[] = [];
  if (droppedChecks > 0) parts.push(`완료 표시했던 ${droppedChecks}개 항목`);
  if (droppedOverrides > 0) parts.push(`직접 고친 날짜 ${droppedOverrides}건`);
  return `${parts.join("과 ")}이 현재 목록에 없어 정리했습니다.`;
}
