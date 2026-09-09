// 화면에 뿌릴 모양으로 데이터를 정리한다.
// 계산은 전부 여기서 하고 화면 컴포넌트는 그리기만 한다. 그래야 계산을 테스트할 수 있다.
//
// 결과를 캐시하지 마라. 앵커를 바꾸면 즉시 전부 재배치되어야 한다.

import type { Store, SubTask, Task, TaskOverride } from "../types";
import { checkKey, effectiveOffset, isOffsetCustomized } from "../types";
import { daysUntil, formatKo, offsetLabel, resolveDate, schoolYearMonths, toISO } from "./dates";
import { effectiveAnchor, type AnchorSource, type EffectiveAnchor } from "./sheet";

/** 며칠 안으로 다가온 것을 「임박」으로 볼 것인가. 이 앱을 쓰는 이유가 이 강조다. */
export const SOON_DAYS = 7;

/**
 * 며칠까지 지난 것을 「지금 해야 할 일」로 볼 것인가.
 *
 * 9월에 앱을 열면 3~8월 항목이 전부 미완료로 남아 있다. 그것을 모두 「지연」으로 세면
 * 화면이 「204일 지남」으로 뒤덮여, 정작 이번 주에 해야 할 일이 묻힌다.
 * 한 달이 넘게 지난 것은 따로 모아 조용히 보여 준다.
 */
export const MISSED_DAYS = 30;

export type SubtaskStatus =
  | "done" // 완료 표시함
  | "late" // 기한이 지났는데 아직 안 함. 아직 만회할 수 있는 범위
  | "missed" // 한 달 넘게 지난 미완료. 지난 일로 넘긴다
  | "soon" // 7일 안에 해야 함
  | "upcoming"; // 아직 여유 있음

export interface ViewSubtask {
  subtask: SubTask;
  /** 기안 제목 예시. 「○○학년도」 자리를 실제 학년도로 채운 값. 복사 버튼이 이걸 쓴다. */
  draftTitle?: string;
  key: string;
  date: Date;
  dateText: string;
  offset: number;
  dLabel: string;
  status: SubtaskStatus;
  days: number;
  /** 주말 보정으로 날짜가 옮겨졌는가. */
  shifted: boolean;
  /** 사용자가 준비 기간을 제안값에서 바꾼 항목인가. */
  customized: boolean;
}

export interface ViewTask {
  task: Task;
  anchor: EffectiveAnchor;
  anchorSource: AnchorSource;
  anchorDate: Date;
  anchorText: string;
  /** 날짜 입력칸에 채울 값. 주차로 배치된 업무도 계산된 날짜가 들어간다. */
  anchorISO: string;
  subtasks: ViewSubtask[];
  /** 법정 업무인데 근거가 비어 있는가. 화면에서 경고로 표시한다. */
  needsBasis: boolean;
  lateCount: number;
  soonCount: number;
  missedCount: number;
  doneCount: number;
}

export interface ViewMonth {
  month: number;
  label: string;
  tasks: ViewTask[];
}

export interface ViewSummary {
  late: number;
  soon: number;
  missed: number;
  done: number;
  total: number;
}

export function effectiveEnabled(task: Task, override: TaskOverride | undefined): boolean {
  return override?.enabled ?? task.enabled;
}

function statusOf(checked: boolean, days: number): SubtaskStatus {
  if (checked) return "done";
  if (days < -MISSED_DAYS) return "missed";
  if (days < 0) return "late";
  if (days <= SOON_DAYS) return "soon";
  return "upcoming";
}

export interface BuildViewOptions {
  tasks: Task[];
  store: Store;
  sheetAnchors: Record<string, string>;
  today: Date;
  weekendAdjust?: boolean;
  /** 시트에만 있는 업무. 학교가 시트에 새로 적은 행사다. */
  sheetTasks?: Task[];
  /** 시트에서 「없음」으로 꺼 둔 업무. 학교 전체에 적용된다. */
  sheetDisabled?: readonly string[];
}

function buildTask(task: Task, options: BuildViewOptions): ViewTask | null {
  const { store, sheetAnchors, today, weekendAdjust = true } = options;
  const override = store.overrides[task.id];

  const anchor = effectiveAnchor(task, override?.anchor, sheetAnchors);
  const anchorResolved = resolveDate(anchor.anchor, 0, store.schoolYear, false);
  if (!anchorResolved) return null; // 앵커를 계산 못 하는 업무는 화면에서 뺀다

  const subtasks: ViewSubtask[] = [];
  for (const subtask of task.subtasks) {
    const offset = effectiveOffset(subtask, override);
    const resolved = resolveDate(anchor.anchor, offset, store.schoolYear, weekendAdjust);
    if (!resolved) continue;

    const key = checkKey(task.id, subtask.id);
    const checked = store.checks[key] === true;
    const days = daysUntil(resolved.date, today);

    subtasks.push({
      subtask,
      draftTitle: subtask.draftTitle?.replaceAll("○○학년도", `${store.schoolYear}학년도`),
      key,
      date: resolved.date,
      dateText: formatKo(resolved.date),
      offset,
      dLabel: offsetLabel(offset),
      status: statusOf(checked, days),
      days,
      shifted: resolved.shifted,
      customized: isOffsetCustomized(subtask, override),
    });
  }

  // 사용자가 준비 기간을 바꾸면 순서가 어긋날 수 있으므로 날짜순으로 다시 세운다
  subtasks.sort((a, b) => a.date.getTime() - b.date.getTime() || a.offset - b.offset);

  return {
    task,
    anchor,
    anchorSource: anchor.source,
    anchorDate: anchorResolved.date,
    anchorText: formatKo(anchorResolved.date),
    anchorISO: toISO(anchorResolved.date),
    subtasks,
    needsBasis: task.category === "legal" && !task.basis,
    lateCount: subtasks.filter((s) => s.status === "late").length,
    soonCount: subtasks.filter((s) => s.status === "soon").length,
    missedCount: subtasks.filter((s) => s.status === "missed").length,
    doneCount: subtasks.filter((s) => s.status === "done").length,
  };
}

/**
 * 켜져 있는 업무만 화면에 쓸 모양으로 바꾼다.
 *
 * 시트에서 끈 것이 개인 설정보다 앞선다. 학교가 「우리는 이 행사를 안 한다」고 정한 것이므로
 * 개인이 켜 두었더라도 화면에서 뺀다.
 */
export function buildTasks(options: BuildViewOptions): ViewTask[] {
  const off = new Set(options.sheetDisabled ?? []);
  const all = [...options.tasks, ...(options.sheetTasks ?? []), ...options.store.customTasks];

  const result: ViewTask[] = [];
  const seen = new Set<string>();
  for (const task of all) {
    if (seen.has(task.id)) continue; // 시트와 직접 추가에 같은 업무가 있으면 앞의 것을 쓴다
    seen.add(task.id);
    if (off.has(task.id)) continue;
    if (!effectiveEnabled(task, options.store.overrides[task.id])) continue;
    const view = buildTask(task, options);
    if (view) result.push(view);
  }
  return result;
}

/** 3월부터 다음 해 2월까지 달별로 묶는다. 업무가 없는 달도 자리를 남긴다. */
export function groupByMonth(tasks: ViewTask[]): ViewMonth[] {
  return schoolYearMonths().map((month) => ({
    month,
    label: `${month}월`,
    tasks: tasks
      .filter((t) => t.anchorDate.getMonth() + 1 === month)
      .sort((a, b) => a.anchorDate.getTime() - b.anchorDate.getTime()),
  }));
}

/** 상단에 「지금 뭘 해야 하나」로 띄울 숫자. 이 앱을 여는 이유다. */
export function summarize(tasks: ViewTask[]): ViewSummary {
  let late = 0;
  let soon = 0;
  let missed = 0;
  let done = 0;
  let total = 0;
  for (const task of tasks) {
    for (const s of task.subtasks) {
      total += 1;
      if (s.status === "late") late += 1;
      else if (s.status === "soon") soon += 1;
      else if (s.status === "missed") missed += 1;
      else if (s.status === "done") done += 1;
    }
  }
  return { late, soon, missed, done, total };
}

/**
 * 지연·임박 항목만 날짜순으로 추린다. 화면 맨 위에 이것부터 보여 준다.
 * 한 달 넘게 지난 항목은 넣지 않는다. 넣으면 이번 주에 할 일이 묻힌다.
 */
export function urgentItems(tasks: ViewTask[]): { task: ViewTask; subtask: ViewSubtask }[] {
  const items: { task: ViewTask; subtask: ViewSubtask }[] = [];
  for (const task of tasks) {
    for (const subtask of task.subtasks) {
      if (subtask.status === "late" || subtask.status === "soon") items.push({ task, subtask });
    }
  }
  return items.sort((a, b) => a.subtask.date.getTime() - b.subtask.date.getTime());
}
