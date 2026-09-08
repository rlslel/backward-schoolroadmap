import { describe, expect, it } from "vitest";
import { DEPTS, SEED_TASKS } from "./tasks.seed";
import { resolveDate } from "../lib/dates";
import { checkKey, effectiveOffset, isOffsetCustomized, type Category } from "../types";
import { buildSheetTemplate, buildTaskLookup, normalizeTitle, parseSheet } from "../lib/sheet";

const byCategory = (c: Category) => SEED_TASKS.filter((t) => t.category === c);

describe("id 는 중복되면 안 된다", () => {
  it("업무 id 가 전부 다르다", () => {
    const ids = SEED_TASKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("한 업무 안에서 하위 업무 id 가 전부 다르다", () => {
    for (const task of SEED_TASKS) {
      const ids = task.subtasks.map((s) => s.id);
      expect(new Set(ids).size, `${task.id} 의 하위 업무 id 가 겹친다`).toBe(ids.length);
    }
  });

  it("체크 키가 전부 유일하다", () => {
    const keys = SEED_TASKS.flatMap((t) => t.subtasks.map((s) => checkKey(t.id, s.id)));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("id 에 :: 가 들어가면 안 된다", () => {
    // 체크 키 구분자와 겹치면 키가 깨진다
    for (const task of SEED_TASKS) {
      expect(task.id).not.toContain("::");
      for (const sub of task.subtasks) expect(sub.id).not.toContain("::");
    }
  });
});

describe("기획서가 요구한 최소 규모를 채웠다", () => {
  it("법정·필수 8건 이상", () => {
    expect(byCategory("legal").length).toBeGreaterThanOrEqual(8);
  });

  it("통상 학사·연례 10건 이상", () => {
    expect(byCategory("annual").length).toBeGreaterThanOrEqual(10);
  });

  it("공모·목적 3건", () => {
    expect(byCategory("grant").length).toBe(3);
  });

  it("학교 자율·특색은 비어 있다 (사용자가 직접 추가한다)", () => {
    expect(byCategory("custom").length).toBe(0);
  });
});

describe("분류별 기본 상태", () => {
  it("공모·목적 사업은 전부 꺼져 있다", () => {
    for (const task of byCategory("grant")) {
      expect(task.enabled, `${task.id} 는 기본 비활성이어야 한다`).toBe(false);
    }
  });

  it("법정·필수와 통상 학사는 전부 켜져 있다", () => {
    for (const task of [...byCategory("legal"), ...byCategory("annual")]) {
      expect(task.enabled, `${task.id} 는 기본 활성이어야 한다`).toBe(true);
    }
  });
});

describe("근거 표기 규칙", () => {
  it("법정 업무의 basis 는 추측으로 채워져 있지 않다", () => {
    // 시행 시기와 근거는 시도·연도별로 다르다. 확인 전까지 비워 두는 것이 맞다.
    // 실제 지침을 확인해 채운 뒤에는 이 테스트를 지워도 된다.
    for (const task of byCategory("legal")) {
      expect(task.basis ?? "", `${task.id} 에 확인되지 않은 근거가 들어갔다`).toBe("");
    }
  });

  it("법정 업무는 모두 「근거 확인 필요」 대상으로 잡힌다", () => {
    const 확인필요 = byCategory("legal").filter((t) => !t.basis);
    expect(확인필요.length).toBe(byCategory("legal").length);
  });
});

describe("모든 업무가 실제 날짜로 계산된다", () => {
  it("앵커가 전부 풀린다", () => {
    for (const task of SEED_TASKS) {
      const r = resolveDate(task.anchor, 0, 2026, true);
      expect(r, `${task.id} 의 앵커를 계산하지 못했다`).not.toBeNull();
    }
  });

  it("하위 업무 날짜가 전부 계산된다", () => {
    for (const task of SEED_TASKS) {
      for (const sub of task.subtasks) {
        const r = resolveDate(task.anchor, sub.offsetDays, 2026, true);
        expect(r, `${task.id}::${sub.id} 를 계산하지 못했다`).not.toBeNull();
      }
    }
  });

  it("1·2월 업무는 다음 해로 넘어간다", () => {
    // 졸업식은 2026학년도의 1월 = 2027년 1월이어야 한다
    const graduation = SEED_TASKS.find((t) => t.id === "graduation");
    expect(graduation).toBeDefined();
    const r = resolveDate(graduation!.anchor, 0, 2026, true);
    expect(r!.date.getFullYear()).toBe(2027);
    expect(r!.date.getMonth() + 1).toBe(1);
  });
});

describe("하위 업무 구성", () => {
  it("모든 업무에 하위 업무가 있다", () => {
    for (const task of SEED_TASKS) {
      expect(task.subtasks.length, `${task.id} 에 하위 업무가 없다`).toBeGreaterThan(0);
    }
  });

  it("모든 업무에 당일(offsetDays 0) 항목이 하나 있다", () => {
    for (const task of SEED_TASKS) {
      const dday = task.subtasks.filter((s) => s.offsetDays === 0);
      expect(dday.length, `${task.id} 의 당일 항목이 ${dday.length}개다`).toBe(1);
    }
  });

  it("하위 업무가 offsetDays 순서로 정렬되어 있다", () => {
    // 화면에 그대로 순서대로 뿌리므로 데이터에서 맞춰 둔다
    for (const task of SEED_TASKS) {
      const offsets = task.subtasks.map((s) => s.offsetDays);
      expect(offsets, `${task.id} 의 하위 업무 순서가 어긋난다`).toEqual([...offsets].sort((a, b) => a - b));
    }
  });

  it("제목이 비어 있지 않다", () => {
    for (const task of SEED_TASKS) {
      expect(task.title.trim()).not.toBe("");
      for (const sub of task.subtasks) expect(sub.title.trim(), `${task.id}::${sub.id}`).not.toBe("");
    }
  });
});

describe("개인정보가 들어가지 않았다", () => {
  it("성명·연락처·학번을 담는 필드가 없다", () => {
    const 금지어 = ["성명", "이름", "연락처", "전화번호", "휴대전화", "학번", "주민등록"];
    const 전체 = JSON.stringify(SEED_TASKS);
    for (const 말 of 금지어) {
      expect(전체, `시드 데이터에 「${말}」이 들어 있다`).not.toContain(말);
    }
  });
});

describe("부서와 학년", () => {
  it("부서가 정해진 목록 안에 있다", () => {
    for (const task of SEED_TASKS) {
      expect(DEPTS, `${task.id} 의 부서 「${task.dept}」가 목록에 없다`).toContain(task.dept);
    }
  });

  it("학년을 지정한 경우 1~6 사이다", () => {
    for (const task of SEED_TASKS) {
      for (const g of task.grades ?? []) {
        expect(g, `${task.id} 의 학년 값이 이상하다`).toBeGreaterThanOrEqual(1);
        expect(g).toBeLessThanOrEqual(6);
      }
    }
  });

  it("앵커의 월과 주차가 유효한 범위다", () => {
    for (const task of SEED_TASKS) {
      if (task.anchor.mode !== "week") continue;
      expect(task.anchor.month, `${task.id}`).toBeGreaterThanOrEqual(1);
      expect(task.anchor.month).toBeLessThanOrEqual(12);
      expect(task.anchor.week, `${task.id}`).toBeGreaterThanOrEqual(1);
      expect(task.anchor.week).toBeLessThanOrEqual(5);
    }
  });
});

describe("시트에 한글 이름으로 적을 수 있다", () => {
  it("다듬은 업무 이름이 서로 겹치지 않는다", () => {
    // 겹치면 시트에 이름을 적었을 때 어느 업무인지 정할 수 없다
    const titles = SEED_TASKS.map((t) => normalizeTitle(t.title));
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("업무 이름으로 시트를 읽으면 그 업무를 찾는다", () => {
    const lookup = buildTaskLookup(SEED_TASKS);
    const csv = "업무,확정일\n가을 운동회,2026-09-11\n졸업식,2027-01-09\n봄 현장체험학습,2026-05-08";
    const r = parseSheet(csv, lookup);
    expect(r.anchors).toEqual({
      "sports-day": "2026-09-11",
      graduation: "2027-01-09",
      "field-trip-spring": "2026-05-08",
    });
    expect(r.unknownIds).toEqual([]);
  });

  it("서식에 27건이 모두 들어간다", () => {
    const csv = buildSheetTemplate(SEED_TASKS);
    const rows = csv.split("\r\n");
    expect(rows.length).toBe(SEED_TASKS.length + 1); // 머리글 한 줄
    expect(rows[0]).toBe("업무,확정일");
  });
});

describe("준비 기간은 사용자가 고칠 수 있다", () => {
  const task = SEED_TASKS.find((t) => t.id === "sports-day")!;
  const quote = task.subtasks.find((s) => s.id === "quote")!;

  it("고치지 않으면 시드의 제안값을 쓴다", () => {
    expect(effectiveOffset(quote, undefined)).toBe(quote.offsetDays);
    expect(isOffsetCustomized(quote, undefined)).toBe(false);
  });

  it("고친 값이 있으면 그 값을 쓴다", () => {
    const override = { offsets: { quote: -45 } };
    expect(effectiveOffset(quote, override)).toBe(-45);
    expect(isOffsetCustomized(quote, override)).toBe(true);
  });

  it("다른 하위 업무는 영향받지 않는다", () => {
    const safety = task.subtasks.find((s) => s.id === "safety")!;
    expect(effectiveOffset(safety, { offsets: { quote: -45 } })).toBe(safety.offsetDays);
  });

  it("이상한 값이 들어 있으면 제안값으로 돌아간다", () => {
    for (const junk of [NaN, Infinity, "삼십" as unknown as number, null as unknown as number]) {
      expect(effectiveOffset(quote, { offsets: { quote: junk } })).toBe(quote.offsetDays);
    }
  });

  it("고친 값과 같게 되돌리면 조정 표시가 사라진다", () => {
    expect(isOffsetCustomized(quote, { offsets: { quote: quote.offsetDays } })).toBe(false);
  });
});
