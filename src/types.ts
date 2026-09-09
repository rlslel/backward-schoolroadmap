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
  /**
   * 사용자가 고친 준비 기간. 하위 업무 id → offsetDays.
   * 시드의 offsetDays 는 규정이 아니라 제안값이고 일하는 방식은 사람마다 다르다.
   * 「D-30 이 아니라 D-45 는 돼야 한다」는 판단을 각자 반영할 수 있어야 한다.
   */
  offsets?: Record<string, number>;
}

export interface UiState {
  dept: string; // "전체" 또는 부서명
  grade: number | "all";
  category: Category | "all";
  month: number | "all";
  /** 회의 안건에서 고른 회의체. 없으면 전체. */
  meetingId?: string;
}

/**
 * 학교가 직접 만드는 회의체.
 *
 * 학교마다 회의 이름과 묶는 방식이 다르다. 어떤 학교는 부서별로, 어떤 학교는 학년별로,
 * 어떤 학교는 주제별로 모인다. 코드에 특정 학교의 회의 이름을 박으면 다른 학교에서 못 쓴다.
 * 그래서 이름과 범위를 학교가 정하게 한다.
 */
export interface MeetingBody {
  id: string;
  name: string; // "미래두레", "3학년 교실마실"
  note?: string; // "매주 화요일" 같은 자유 표기
  /** 아래 셋이 모두 비면 전체 업무를 본다. 하나라도 있으면 해당하는 것만 본다. */
  depts: string[];
  grades: number[];
  taskIds: string[];
}

export interface Store {
  v: 1; // 스키마 버전. 절대 빼지 마라
  schoolYear: number; // 2026학년도 = 2026. 3. 1. ~ 2027. 2. 말일
  overrides: Record<string, TaskOverride>;
  customTasks: Task[];
  sheetUrl?: string; // 학교 공유 시트의 「웹에 게시」 CSV 주소
  meetings: MeetingBody[]; // 학교가 직접 만든 회의체
  checks: Record<string, boolean>; // "taskId::subtaskId" → 완료 여부
  ui: UiState;
}

export const SCHEMA_VERSION = 1;

export function checkKey(taskId: string, subtaskId: string): string {
  return `${taskId}::${subtaskId}`;
}

/** 준비 기간이 며칠인지. 사용자가 고쳤으면 그 값을, 아니면 시드의 제안값을 쓴다. */
export function effectiveOffset(subtask: SubTask, override: TaskOverride | undefined): number {
  const custom = override?.offsets?.[subtask.id];
  return typeof custom === "number" && Number.isFinite(custom) ? custom : subtask.offsetDays;
}

/** 사용자가 제안값에서 바꾼 항목인지. 화면에서 「직접 조정함」으로 구분해 보여 준다. */
export function isOffsetCustomized(subtask: SubTask, override: TaskOverride | undefined): boolean {
  return effectiveOffset(subtask, override) !== subtask.offsetDays;
}
