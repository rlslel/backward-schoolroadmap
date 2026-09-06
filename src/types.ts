// 앱 전체가 공유하는 자료 구조. 기획서 3장과 일치해야 한다.

export type Category = "legal" | "annual" | "grant" | "custom";
// legal: 법정·필수 공통 / annual: 통상 학사·연례 행사
// grant: 공모·목적 사업   / custom: 학교 자율·특색 사업

export const CATEGORY_LABEL: Record<Category, string> = {
  legal: "법정·필수",
  annual: "통상 학사",
  grant: "공모·목적",
  custom: "학교 자율",
};

export interface SubTask {
  id: string;
  title: string; // "물품 구입 품의"
  offsetDays: number; // 앵커 기준 상대일. -30, -14, +3
  draftTitle?: string; // 기안 제목 예시 (복사 버튼 대상)
  attachments?: string[]; // 붙임 서류 목록
  caution?: string; // 자주 틀리는 점 한 줄
}

export type Anchor =
  | { mode: "date"; date: string } // "2026-09-11"
  | { mode: "week"; month: number; week: number }; // 5월 2주차

export interface Task {
  id: string;
  title: string;
  category: Category;
  dept: string; // "공통" | "체육" | "연구" | "정보" | "생활" | "방과후" ...
  grades?: number[]; // 관련 학년. 비우면 전 학년
  anchor: Anchor;
  basis?: string; // 근거 법령·지침명
  subtasks: SubTask[];
  enabled: boolean; // grant 계열은 기본 false
  memo?: string;
}

/** 시드 업무에 대해 사용자가 바꾼 부분만 담는다. 업무 전체를 복사해 두지 않는다. */
export interface TaskOverride {
  anchor?: Anchor;
  enabled?: boolean;
  memo?: string;
}

export interface UiState {
  dept: string; // "전체" 또는 부서명
  grade: number | "all";
  category: Category | "all";
  month: number | "all";
}

export interface Store {
  v: 1; // 스키마 버전. 절대 빼지 마라
  schoolYear: number; // 2026학년도 = 2026. 3. 1. ~ 2027. 2. 말일
  overrides: Record<string, TaskOverride>;
  customTasks: Task[];
  sheetUrl?: string; // 학교 공유 시트의 「웹에 게시」 CSV 주소
  checks: Record<string, boolean>; // "taskId::subtaskId" → 완료 여부
  ui: UiState;
}

export const SCHEMA_VERSION = 1;

export function checkKey(taskId: string, subtaskId: string): string {
  return `${taskId}::${subtaskId}`;
}
