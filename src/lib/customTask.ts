// 학교가 자기 업무를 직접 추가하고, 필요 없는 업무를 끄는 부분.
//
// 이 둘이 있어야 같은 앱이 학교마다 다른 모습이 된다.
// 다른 학교가 링크를 받아서 자기 학교 모양으로 만들 수 있어야 조건 ①이 성립한다.

import type { Store, SubTask, Task } from "../types";

/** 새로 만드는 업무의 기본 준비 절차. 학교 행사에 대체로 공통인 흐름이다. */
export const DEFAULT_SUBTASKS: SubTask[] = [
  { id: "plan", title: "운영 계획 수립", offsetDays: -30 },
  { id: "quote", title: "물품 구입 품의", offsetDays: -21 },
  { id: "notice", title: "가정통신문 발송", offsetDays: -7 },
  { id: "run", title: "행사 실시", offsetDays: 0 },
  { id: "settle", title: "예산 집행 정산", offsetDays: 5 },
];

export interface CustomTaskInput {
  title: string;
  dept: string;
  date: string; // "2026-10-15"
  subtasks: { title: string; offsetDays: number }[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** 저장하기 전에 확인한다. 화면에 그대로 보여 줄 수 있는 한국어 문구로 돌려준다. */
export function validateCustomTask(input: CustomTaskInput): ValidationResult {
  const errors: string[] = [];

  if (input.title.trim() === "") errors.push("업무 이름을 적어 주세요.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) errors.push("행사일을 골라 주세요.");
  if (input.dept.trim() === "") errors.push("부서를 골라 주세요.");

  const items = input.subtasks.filter((s) => s.title.trim() !== "");
  if (items.length === 0) errors.push("준비 항목을 하나 이상 적어 주세요.");
  if (items.some((s) => !Number.isFinite(s.offsetDays))) {
    errors.push("준비 항목의 날짜 간격은 숫자로 적어 주세요.");
  }
  if (items.some((s) => Math.abs(s.offsetDays) > 365)) {
    errors.push("날짜 간격은 1년(365일) 안으로 적어 주세요.");
  }

  return { ok: errors.length === 0, errors };
}

/** 업무 id 를 만든다. 한 번 정해지면 바뀌지 않아야 체크 표시가 유지된다. */
export function makeCustomTaskId(existing: ReadonlySet<string>, now = Date.now()): string {
  let candidate = `custom-${now.toString(36)}`;
  let n = 1;
  while (existing.has(candidate)) candidate = `custom-${now.toString(36)}-${n++}`;
  return candidate;
}

/** 하위 업무 id 도 겹치면 안 된다. 겹치면 체크가 뒤섞인다. */
function makeSubtaskIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `s${i + 1}`);
}

export function buildCustomTask(input: CustomTaskInput, existingIds: ReadonlySet<string>, now = Date.now()): Task {
  const items = input.subtasks
    .filter((s) => s.title.trim() !== "")
    .sort((a, b) => a.offsetDays - b.offsetDays);

  const ids = makeSubtaskIds(items.length);

  return {
    id: makeCustomTaskId(existingIds, now),
    title: input.title.trim(),
    category: "custom",
    dept: input.dept.trim(),
    anchor: { mode: "date", date: input.date },
    enabled: true,
    subtasks: items.map((s, i) => ({
      id: ids[i],
      title: s.title.trim(),
      offsetDays: s.offsetDays,
    })),
  };
}

// ── 끄고 켜기 ─────────────────────────────────────────────────────

export function setEnabled(store: Store, taskId: string, enabled: boolean): Store {
  const prev = store.overrides[taskId] ?? {};
  return { ...store, overrides: { ...store.overrides, [taskId]: { ...prev, enabled } } };
}

export function addCustomTask(store: Store, task: Task): Store {
  return { ...store, customTasks: [...store.customTasks, task] };
}

/**
 * 직접 추가한 업무를 지운다. 딸린 체크와 수정 내용도 함께 정리한다.
 * 남겨 두면 다음에 같은 id 가 생겼을 때 엉뚱한 체크가 되살아난다.
 */
export function removeCustomTask(store: Store, taskId: string): Store {
  const checks: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(store.checks)) {
    if (!key.startsWith(`${taskId}::`)) checks[key] = value;
  }

  const overrides = { ...store.overrides };
  delete overrides[taskId];

  return {
    ...store,
    customTasks: store.customTasks.filter((t) => t.id !== taskId),
    checks,
    overrides,
  };
}

/** 시드 업무 중 꺼 둔 것. 관리 화면에서 다시 켤 수 있게 목록으로 보여 준다. */
export function disabledSeedTasks(store: Store, seed: Task[]): Task[] {
  return seed.filter((task) => {
    const override = store.overrides[task.id];
    // 원래부터 꺼져 있던 공모 사업은 「내가 끈 것」이 아니므로 따로 다룬다
    return override?.enabled === false;
  });
}

/** 기본으로 꺼져 있는 업무(공모 사업 등) 중 아직 켜지 않은 것. */
export function offByDefaultTasks(store: Store, seed: Task[]): Task[] {
  return seed.filter((task) => !task.enabled && store.overrides[task.id]?.enabled !== true);
}
