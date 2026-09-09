// 학사 일정 탭의 필터. 부서·학년·분류·월로 걸러 「내 업무만」 본다.
//
// 필터 상태는 localStorage 에 저장되어 새로고침해도 유지된다.

import type { Category, Task, UiState } from "../types";
import type { ViewMonth, ViewTask } from "./view";

export const ALL = "전체";

/**
 * 학년 필터 규칙.
 * 학년 N을 고르면 `grades` 에 N이 든 업무와 **`grades` 가 비어 있는 전 학년 업무를 함께** 본다.
 * 비어 있는 것을 「해당 없음」으로 처리하면 법정 업무가 통째로 사라진다.
 */
export function matchesGrade(task: Task, grade: number | "all"): boolean {
  if (grade === "all") return true;
  if (!task.grades || task.grades.length === 0) return true;
  return task.grades.includes(grade);
}

export function matchesDept(task: Task, dept: string): boolean {
  return dept === ALL || task.dept === dept;
}

export function matchesCategory(task: Task, category: Category | "all"): boolean {
  return category === "all" || task.category === category;
}

export function filterTasks(views: ViewTask[], ui: UiState): ViewTask[] {
  return views.filter(
    (v) =>
      matchesDept(v.task, ui.dept) &&
      matchesGrade(v.task, ui.grade) &&
      matchesCategory(v.task, ui.category),
  );
}

/** 월 필터는 달 묶음 단계에서 건다. 「9월만」을 고르면 9월 칸만 남는다. */
export function filterMonths(months: ViewMonth[], month: number | "all"): ViewMonth[] {
  return month === "all" ? months : months.filter((m) => m.month === month);
}

export function isFiltering(ui: UiState): boolean {
  return ui.dept !== ALL || ui.grade !== "all" || ui.category !== "all" || ui.month !== "all";
}

export function clearedFilter(ui: UiState): UiState {
  return { ...ui, dept: ALL, grade: "all", category: "all", month: "all" };
}

/** 필터가 걸려 있을 때 「무엇으로 걸렀는지」 한 줄로 알려 준다. */
export function describeFilter(ui: UiState): string {
  const parts: string[] = [];
  if (ui.dept !== ALL) parts.push(ui.dept);
  if (ui.grade !== "all") parts.push(`${ui.grade}학년`);
  if (ui.category !== "all") parts.push(CATEGORY_FILTER_LABEL[ui.category]);
  if (ui.month !== "all") parts.push(`${ui.month}월`);
  return parts.join(" · ");
}

const CATEGORY_FILTER_LABEL: Record<Category, string> = {
  legal: "법정·필수",
  annual: "통상 학사",
  grant: "공모·목적",
  custom: "학교 자율",
};
