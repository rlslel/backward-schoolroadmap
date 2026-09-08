// 메인 화면 네 칸과 회의 안건에 쓸 목록을 뽑는다.
// 새로 저장하는 데이터는 없다. 이미 있는 업무를 다르게 묶어 보여 줄 뿐이다.

import { daysUntil } from "./dates";
import type { ViewSubtask, ViewTask } from "./view";

/** 「1달 내」의 기준. 부서 회의가 보통 한 달에 한 번이라 여기에 맞춘다. */
export const AGENDA_DAYS = 30;

export const ALL_DEPTS = "전체";

export interface AgendaEntry {
  task: ViewTask;
  /** 회의에서 다룰 하위 업무. 이미 한 것과 한참 지난 것은 뺀다. */
  items: ViewSubtask[];
}

function inWindow(item: ViewSubtask, days: number): boolean {
  if (item.status === "done" || item.status === "missed") return false;
  return item.days <= days;
}

/** 부서 목록. 실제로 업무가 있는 부서만 고른다. */
export function deptsOf(views: ViewTask[]): string[] {
  const set = new Set<string>();
  for (const v of views) set.add(v.task.dept);
  return [...set].sort((a, b) => a.localeCompare(b, "ko"));
}

export function matchesDept(view: ViewTask, dept: string): boolean {
  return dept === ALL_DEPTS || view.task.dept === dept;
}

/**
 * 부서 회의 안건.
 * 「이번 달에 우리 부서가 처리해야 할 것」을 업무별로 묶는다. 지연된 것도 함께 올린다.
 */
export function meetingAgenda(views: ViewTask[], dept: string, days = AGENDA_DAYS): AgendaEntry[] {
  const entries: AgendaEntry[] = [];
  for (const view of views) {
    if (!matchesDept(view, dept)) continue;
    const items = view.subtasks.filter((s) => inWindow(s, days));
    if (items.length > 0) entries.push({ task: view, items });
  }
  return entries.sort((a, b) => a.items[0].date.getTime() - b.items[0].date.getTime());
}

/** 통상 학사·연례 행사 중 앞으로 한 달 안에 있는 것. */
export function upcomingAcademic(views: ViewTask[], today: Date, days = AGENDA_DAYS): ViewTask[] {
  return views
    .filter((v) => v.task.category === "annual")
    .filter((v) => {
      const d = daysUntil(v.anchorDate, today);
      return d >= 0 && d <= days;
    })
    .sort((a, b) => a.anchorDate.getTime() - b.anchorDate.getTime());
}

export type DecisionReason = "날짜 미확정" | "근거 확인 필요";

export interface PendingDecision {
  view: ViewTask;
  /** 무엇을 정해야 하는가. 한 업무에 두 가지가 겹치면 함께 담는다. */
  reasons: DecisionReason[];
}

/**
 * 「정해야 할 것」.
 *
 * 회의에서 「이건 언제로 할까요」, 「이 근거가 맞나요」라고 물어야 하는 항목을 모은다.
 * 한 업무에 두 가지가 겹쳐도 줄은 하나만 만든다. 같은 업무가 두 번 나오면 잘못된 것처럼 보인다.
 */
export function pendingDecisions(views: ViewTask[], today: Date): PendingDecision[] {
  const list: PendingDecision[] = [];
  for (const view of views) {
    // 이미 지난 행사는 이제 와서 정할 것이 없다
    if (daysUntil(view.anchorDate, today) < 0) continue;

    const reasons: DecisionReason[] = [];
    if (view.anchorSource === "seed") reasons.push("날짜 미확정");
    if (view.needsBasis) reasons.push("근거 확인 필요");

    if (reasons.length > 0) list.push({ view, reasons });
  }
  return list.sort((a, b) => a.view.anchorDate.getTime() - b.view.anchorDate.getTime());
}

/** 인쇄물 제목에 쓸 「2026학년도 9월 체육부 협의 안건」. */
export function agendaTitle(schoolYear: number, today: Date, dept: string): string {
  const 부서 = dept === ALL_DEPTS ? "전체" : dept;
  return `${schoolYear}학년도 ${today.getMonth() + 1}월 ${부서} 협의 안건`;
}
