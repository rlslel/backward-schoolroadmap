// 역산 계산. 이 앱의 핵심이자, 틀리면 앱을 안 쓰느니만 못한 부분이다.
// 시간대 문제를 피하려고 Date 는 항상 로컬 생성자(new Date(y, m, d))로만 만든다.

import type { Anchor } from "../types";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** "2026-09-11" → Date. 형식이 틀리거나 존재하지 않는 날짜면 null. */
export function parseISO(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  // new Date(2026, 1, 30) 은 3월 2일로 굴러간다. 되돌려 확인한다.
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

export function toISO(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function isWeekend(date: Date): boolean {
  const w = date.getDay();
  return w === 0 || w === 6;
}

/**
 * 학년도 경계 규칙. 학년도는 당해 3월 1일 ~ 익년 2월 말일이다.
 * 3~12월은 그 해, 1~2월은 다음 해에 속한다.
 * 예) 2026학년도의 1월은 2027년 1월이다.
 */
export function calendarYearOf(schoolYear: number, month: number): number {
  return month >= 3 ? schoolYear : schoolYear + 1;
}

/**
 * 해당 월의 `week`번째 월요일. 그 달에 없으면(예: 월요일이 4번뿐인 달의 5주차)
 * 그 달의 마지막 월요일로 처리한다.
 */
export function nthMonday(year: number, month: number, week: number): Date {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const firstMonday = 1 + ((8 - firstDow) % 7);
  const lastDayOfMonth = new Date(year, month, 0).getDate();

  let day = firstMonday + (Math.max(1, week) - 1) * 7;
  while (day > lastDayOfMonth) day -= 7;

  return new Date(year, month - 1, day);
}

/** 앵커를 실제 기준일로 바꾼다. 날짜 형식이 잘못된 앵커는 null. */
export function resolveAnchorDate(anchor: Anchor, schoolYear: number): Date | null {
  if (anchor.mode === "date") return parseISO(anchor.date);
  const year = calendarYearOf(schoolYear, anchor.month);
  return nthMonday(year, anchor.month, anchor.week);
}

/**
 * 주말 보정.
 * - offsetDays < 0 (선행 준비): 토·일이면 직전 금요일로 당긴다. 준비는 늦으면 안 된다.
 * - offsetDays === 0 (앵커 당일): 보정하지 않는다. 사용자가 직접 넣은 행사일을 앱이 옮기면 안 된다.
 * - offsetDays > 0 (후행 정산): 토·일이면 다음 월요일로 미룬다. 정산은 빨라질 수 없다.
 * 공휴일·재량휴업일은 보정하지 않는다. 매년 바뀌고 학교마다 달라 오히려 틀린 날짜를 만든다.
 */
export function applyWeekendShift(date: Date, offsetDays: number, enabled: boolean): Date {
  if (!enabled || offsetDays === 0 || !isWeekend(date)) return date;
  const saturday = date.getDay() === 6;
  if (offsetDays > 0) return addDays(date, saturday ? 2 : 1);
  return addDays(date, saturday ? -1 : -2);
}

export interface ResolvedDate {
  date: Date;
  /** 주말 보정으로 날짜가 옮겨졌는지. 화면에 「주말 보정」 표시를 붙이는 데 쓴다. */
  shifted: boolean;
  /** 보정 전 날짜. 옮겨지지 않았으면 date 와 같다. */
  rawDate: Date;
}

/**
 * 앵커 + offsetDays → 실제 날짜.
 * 결과를 캐시하지 마라. 앵커를 바꾸면 즉시 전부 재배치되어야 한다.
 */
export function resolveDate(
  anchor: Anchor,
  offsetDays: number,
  schoolYear: number,
  weekendAdjust: boolean,
): ResolvedDate | null {
  const base = resolveAnchorDate(anchor, schoolYear);
  if (!base) return null;
  const rawDate = addDays(base, offsetDays);
  const date = applyWeekendShift(rawDate, offsetDays, weekendAdjust);
  return { date, rawDate, shifted: date.getTime() !== rawDate.getTime() };
}

/** "9. 11.(금)" */
export function formatKo(date: Date): string {
  return `${date.getMonth() + 1}. ${date.getDate()}.(${DAY_NAMES[date.getDay()]})`;
}

/** "D-30" | "D-DAY" | "D+3" */
export function offsetLabel(offsetDays: number): string {
  if (offsetDays === 0) return "D-DAY";
  return offsetDays < 0 ? `D${offsetDays}` : `D+${offsetDays}`;
}

/** 오늘부터 며칠 뒤인가. 음수면 이미 지난 날이다. 시각은 무시하고 날짜만 본다. */
export function daysUntil(date: Date, today: Date): number {
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** 학년도에 속하는 달을 3월부터 다음 해 2월까지 순서대로 돌려준다. */
export function schoolYearMonths(): number[] {
  return [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];
}
