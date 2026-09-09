// 학교가 직접 만드는 회의체.
//
// 학교마다 회의 이름과 묶는 방식이 다르다. 부서별로 모이는 학교, 학년별로 모이는 학교,
// 주제별로 모이는 학교가 다 다르다. 특정 학교의 회의 이름을 코드에 박으면 다른 학교에서 못 쓴다.
// 그래서 기본 회의체(전체·부서별)만 자동으로 만들고, 나머지는 학교가 직접 만든다.

import type { MeetingBody, Store, Task } from "../types";
import type { ViewTask } from "./view";

export const ALL_MEETING_ID = "__all__";
const DEPT_PREFIX = "__dept__";

export function deptMeetingId(dept: string): string {
  return `${DEPT_PREFIX}${dept}`;
}

/** 어느 학교에나 있는 기본 회의체. 전체 한 개와 부서별 한 개씩. */
export function builtinMeetings(depts: string[]): MeetingBody[] {
  return [
    { id: ALL_MEETING_ID, name: "전체", depts: [], grades: [], taskIds: [] },
    ...depts.map((dept) => ({
      id: deptMeetingId(dept),
      name: dept,
      depts: [dept],
      grades: [],
      taskIds: [],
    })),
  ];
}

/** 기본 회의체 + 학교가 만든 회의체. 고르는 목록에 그대로 쓴다. */
export function allMeetings(store: Store, depts: string[]): MeetingBody[] {
  return [...builtinMeetings(depts), ...store.meetings];
}

export function findMeeting(store: Store, depts: string[], id: string | undefined): MeetingBody {
  const list = allMeetings(store, depts);
  return list.find((m) => m.id === id) ?? list[0];
}

export function isBuiltin(meeting: MeetingBody): boolean {
  return meeting.id === ALL_MEETING_ID || meeting.id.startsWith(DEPT_PREFIX);
}

/**
 * 이 회의에서 다룰 업무인가.
 *
 * 부서·학년·직접 고른 업무 중 하나라도 걸리면 다룬다(합집합).
 * 셋 다 비어 있으면 전체를 다룬다.
 *
 * 학년을 지정한 회의는 그 학년 업무와 **전 학년 공통 업무**를 함께 본다.
 * 학년이 비어 있는 업무를 「해당 없음」으로 처리하면 법정 업무가 통째로 빠진다.
 */
export function matchesMeeting(task: Task, meeting: MeetingBody): boolean {
  const 범위없음 =
    meeting.depts.length === 0 && meeting.grades.length === 0 && meeting.taskIds.length === 0;
  if (범위없음) return true;

  if (meeting.taskIds.includes(task.id)) return true;
  if (meeting.depts.includes(task.dept)) return true;

  if (meeting.grades.length > 0) {
    const 전학년 = !task.grades || task.grades.length === 0;
    if (전학년) return true;
    if (task.grades!.some((g) => meeting.grades.includes(g))) return true;
  }

  return false;
}

export function filterByMeeting(views: ViewTask[], meeting: MeetingBody): ViewTask[] {
  return views.filter((v) => matchesMeeting(v.task, meeting));
}

// ── 만들고 지우기 ─────────────────────────────────────────────────

export interface MeetingInput {
  name: string;
  note: string;
  depts: string[];
  grades: number[];
  taskIds: string[];
}

export function validateMeeting(input: MeetingInput, existing: MeetingBody[]): string[] {
  const errors: string[] = [];
  const name = input.name.trim();

  if (name === "") errors.push("회의 이름을 적어 주세요.");
  if (existing.some((m) => m.name === name)) errors.push("같은 이름의 회의가 이미 있습니다.");

  return errors;
}

export function makeMeetingId(existing: ReadonlySet<string>, now = Date.now()): string {
  let candidate = `meet-${now.toString(36)}`;
  let n = 1;
  while (existing.has(candidate)) candidate = `meet-${now.toString(36)}-${n++}`;
  return candidate;
}

export function buildMeeting(input: MeetingInput, existing: ReadonlySet<string>, now = Date.now()): MeetingBody {
  return {
    id: makeMeetingId(existing, now),
    name: input.name.trim(),
    note: input.note.trim() || undefined,
    depts: [...input.depts],
    grades: [...input.grades].sort((a, b) => a - b),
    taskIds: [...input.taskIds],
  };
}

export function addMeeting(store: Store, meeting: MeetingBody): Store {
  return { ...store, meetings: [...store.meetings, meeting] };
}

export function removeMeeting(store: Store, meetingId: string): Store {
  const ui = store.ui.meetingId === meetingId ? { ...store.ui, meetingId: undefined } : store.ui;
  return { ...store, meetings: store.meetings.filter((m) => m.id !== meetingId), ui };
}

/** 회의 범위를 사람이 읽을 수 있게 한 줄로. */
export function describeScope(meeting: MeetingBody): string {
  const parts: string[] = [];
  if (meeting.depts.length > 0) parts.push(meeting.depts.join("·"));
  if (meeting.grades.length > 0) parts.push(`${meeting.grades.join("·")}학년`);
  if (meeting.taskIds.length > 0) parts.push(`직접 고른 업무 ${meeting.taskIds.length}건`);
  return parts.length === 0 ? "전체 업무" : parts.join(" + ");
}
