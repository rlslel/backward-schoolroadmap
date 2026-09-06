import { describe, expect, it } from "vitest";
import {
  addDays,
  applyWeekendShift,
  calendarYearOf,
  daysUntil,
  formatKo,
  nthMonday,
  offsetLabel,
  parseISO,
  resolveDate,
  toISO,
} from "./dates";
import type { Anchor } from "../types";

const D = (s: string) => {
  const d = parseISO(s);
  if (!d) throw new Error(`테스트 날짜가 잘못되었다: ${s}`);
  return d;
};
const iso = (a: Anchor, off: number, year = 2026, adjust = true) => {
  const r = resolveDate(a, off, year, adjust);
  if (!r) throw new Error("역산 실패");
  return toISO(r.date);
};
const onDate = (date: string): Anchor => ({ mode: "date", date });

describe("날짜 파싱", () => {
  it("정상 날짜를 읽는다", () => {
    expect(toISO(D("2026-09-11"))).toBe("2026-09-11");
  });

  it("존재하지 않는 날짜를 거부한다", () => {
    expect(parseISO("2026-02-30")).toBeNull();
    expect(parseISO("2027-02-29")).toBeNull(); // 2027 은 평년
    expect(parseISO("2026-13-01")).toBeNull();
    expect(parseISO("2026/09/11")).toBeNull();
    expect(parseISO("")).toBeNull();
  });

  it("윤년 2월 29일은 받아들인다", () => {
    expect(toISO(D("2028-02-29"))).toBe("2028-02-29");
  });
});

describe("학년도 경계 — 1·2월은 다음 해다", () => {
  it("3~12월은 학년도와 같은 해", () => {
    expect(calendarYearOf(2026, 3)).toBe(2026);
    expect(calendarYearOf(2026, 12)).toBe(2026);
  });

  it("1~2월은 학년도 + 1", () => {
    expect(calendarYearOf(2026, 1)).toBe(2027);
    expect(calendarYearOf(2026, 2)).toBe(2027);
  });

  it("2026학년도 1월 2주차는 2027년 1월 11일이다", () => {
    // 이걸 놓치면 일정이 11개월 어긋난다
    expect(iso({ mode: "week", month: 1, week: 2 }, 0)).toBe("2027-01-11");
  });
});

describe("주차 계산", () => {
  it("그 달의 n번째 월요일을 찾는다", () => {
    expect(toISO(nthMonday(2026, 9, 1))).toBe("2026-09-07");
    expect(toISO(nthMonday(2026, 9, 2))).toBe("2026-09-14");
  });

  it("1일이 월요일이면 그날이 1주차다", () => {
    expect(toISO(nthMonday(2027, 2, 1))).toBe("2027-02-01");
  });

  it("없는 주차는 그 달 마지막 월요일로 처리한다", () => {
    // 2027년 2월 월요일은 1·8·15·22일 네 번뿐이다
    expect(toISO(nthMonday(2027, 2, 5))).toBe("2027-02-22");
    expect(iso({ mode: "week", month: 2, week: 5 }, 0)).toBe("2027-02-22");
  });
});

describe("주말 보정", () => {
  // 2026-09-11 은 금요일, 09-12 토, 09-13 일, 09-14 월
  it("선행 업무가 토요일이면 직전 금요일로 당긴다", () => {
    expect(iso(onDate("2026-09-14"), -2)).toBe("2026-09-11");
  });

  it("선행 업무가 일요일이면 직전 금요일로 당긴다", () => {
    expect(iso(onDate("2026-09-14"), -1)).toBe("2026-09-11");
  });

  it("후행 업무가 토요일이면 다음 월요일로 미룬다", () => {
    expect(iso(onDate("2026-09-11"), 1)).toBe("2026-09-14");
  });

  it("후행 업무가 일요일이면 다음 월요일로 미룬다", () => {
    expect(iso(onDate("2026-09-11"), 2)).toBe("2026-09-14");
  });

  it("앵커 당일은 토·일이어도 움직이지 않는다", () => {
    // 사용자가 직접 넣은 행사일을 앱이 옮기면 안 된다
    expect(iso(onDate("2026-09-12"), 0)).toBe("2026-09-12");
    expect(iso(onDate("2026-09-13"), 0)).toBe("2026-09-13");
  });

  it("보정을 끄면 계산식 그대로 나온다", () => {
    expect(iso(onDate("2026-09-11"), 1, 2026, false)).toBe("2026-09-12");
    expect(iso(onDate("2026-09-14"), -1, 2026, false)).toBe("2026-09-13");
  });

  it("평일은 건드리지 않는다", () => {
    expect(iso(onDate("2026-09-11"), -7)).toBe("2026-09-04");
  });

  it("보정은 한 번만 적용되어 결과가 다시 주말이 되지 않는다", () => {
    for (const start of ["2026-09-12", "2026-09-13"]) {
      for (const off of [-1, 1, -14, 14]) {
        const r = resolveDate(onDate(start), off, 2026, true);
        expect(r).not.toBeNull();
        expect(r!.date.getDay()).not.toBe(0);
        expect(r!.date.getDay()).not.toBe(6);
      }
    }
  });

  it("보정 여부를 shifted 로 알려준다", () => {
    expect(resolveDate(onDate("2026-09-11"), 1, 2026, true)!.shifted).toBe(true);
    expect(resolveDate(onDate("2026-09-11"), -7, 2026, true)!.shifted).toBe(false);
  });

  it("applyWeekendShift 를 직접 불러도 같은 규칙을 따른다", () => {
    expect(toISO(applyWeekendShift(D("2026-09-12"), -1, true))).toBe("2026-09-11");
    expect(toISO(applyWeekendShift(D("2026-09-12"), 1, true))).toBe("2026-09-14");
    expect(toISO(applyWeekendShift(D("2026-09-12"), 0, true))).toBe("2026-09-12");
  });
});

describe("월·연 경계와 윤년", () => {
  it("월 경계를 넘는 오프셋", () => {
    // 2027-03-05 에서 30일 전은 2027-02-03 (2027년 2월은 28일까지)
    expect(iso(onDate("2027-03-05"), -30, 2026, false)).toBe("2027-02-03");
  });

  it("연 경계를 넘는 오프셋", () => {
    expect(iso(onDate("2027-01-05"), -10, 2026, false)).toBe("2026-12-26");
  });

  it("윤년 2월 29일을 정확히 지난다", () => {
    expect(iso(onDate("2028-03-01"), -1, 2027, false)).toBe("2028-02-29");
    expect(iso(onDate("2028-02-29"), 1, 2027, false)).toBe("2028-03-01");
  });

  it("평년에는 2월 29일이 나오지 않는다", () => {
    expect(iso(onDate("2027-03-01"), -1, 2026, false)).toBe("2027-02-28");
  });
});

describe("앵커를 바꾸면 파생 날짜가 전부 따라온다", () => {
  it("행사일을 일주일 미루면 모든 하위 업무가 일주일씩 밀린다", () => {
    const offsets = [-30, -14, -7, 0, 3];
    const before = offsets.map((o) => iso(onDate("2026-09-11"), o, 2026, false));
    const after = offsets.map((o) => iso(onDate("2026-09-18"), o, 2026, false));
    before.forEach((b, i) => {
      expect(toISO(addDays(D(b), 7))).toBe(after[i]);
    });
  });
});

describe("표시 형식", () => {
  it("한국식 날짜로 적는다", () => {
    expect(formatKo(D("2026-09-11"))).toBe("9. 11.(금)");
    expect(formatKo(D("2026-09-14"))).toBe("9. 14.(월)");
  });

  it("D-day 라벨", () => {
    expect(offsetLabel(-30)).toBe("D-30");
    expect(offsetLabel(0)).toBe("D-DAY");
    expect(offsetLabel(3)).toBe("D+3");
  });

  it("남은 날짜를 센다", () => {
    const today = D("2026-09-06");
    expect(daysUntil(D("2026-09-11"), today)).toBe(5);
    expect(daysUntil(D("2026-09-06"), today)).toBe(0);
    expect(daysUntil(D("2026-09-04"), today)).toBe(-2);
  });

  it("서머타임이 있는 지역에서도 날짜 수가 어긋나지 않는다", () => {
    // 시각이 아니라 날짜만 비교하므로 항상 정수가 나온다
    expect(daysUntil(D("2027-03-15"), D("2026-09-06"))).toBe(190);
  });
});
