import { describe, expect, it } from "vitest";
import { buildTasks, groupByMonth, summarize, urgentItems, effectiveEnabled } from "./view";
import { createEmptyStore } from "./storage";
import { parseISO } from "./dates";
import { SEED_TASKS } from "../data/tasks.seed";
import type { Store, Task } from "../types";

const TODAY = parseISO("2026-09-06")!; // 일요일

function storeWith(patch: Partial<Store> = {}): Store {
  return { ...createEmptyStore(2026), ...patch };
}

const SPORTS: Task = {
  id: "sports-day",
  title: "가을 운동회",
  category: "annual",
  dept: "체육",
  anchor: { mode: "date", date: "2026-09-11" }, // 금요일
  enabled: true,
  subtasks: [
    { id: "quote", title: "물품 구입 품의", offsetDays: -30 },
    { id: "notice", title: "가정통신문 발송", offsetDays: -7 },
    { id: "run", title: "운동회 실시", offsetDays: 0 },
    { id: "settle", title: "예산 정산", offsetDays: 5 },
  ],
};

const base = { tasks: [SPORTS], sheetAnchors: {}, today: TODAY };

describe("업무를 화면 모양으로 바꾼다", () => {
  it("앵커와 하위 업무 날짜를 계산한다", () => {
    const [t] = buildTasks({ ...base, store: storeWith() });
    expect(t.anchorText).toBe("9. 11.(금)");
    expect(t.subtasks.map((s) => s.dateText)).toEqual([
      "8. 12.(수)", // D-30
      "9. 4.(금)", // D-7
      "9. 11.(금)", // D-DAY
      "9. 16.(수)", // D+5
    ]);
  });

  it("D-day 라벨을 붙인다", () => {
    const [t] = buildTasks({ ...base, store: storeWith() });
    expect(t.subtasks.map((s) => s.dLabel)).toEqual(["D-30", "D-7", "D-DAY", "D+5"]);
  });
});

describe("지금 뭘 해야 하나 — 상태 판정", () => {
  it("기한이 지났는데 안 했으면 지연", () => {
    const [t] = buildTasks({ ...base, store: storeWith() });
    // 오늘이 9. 6. 이므로 9. 4.(D-7)은 이틀 지났다
    expect(t.subtasks[1].status).toBe("late");
  });

  it("한 달 넘게 지난 것은 지연이 아니라 「지난 일」로 넘긴다", () => {
    // 9월에 앱을 열면 3~8월 항목이 전부 미완료다. 그걸 다 지연으로 세면
    // 화면이 「204일 지남」으로 뒤덮여 이번 주에 할 일이 묻힌다.
    const 봄행사: Task = { ...SPORTS, anchor: { mode: "date", date: "2026-05-08" } };
    const [t] = buildTasks({ ...base, tasks: [봄행사], store: storeWith() });
    expect(t.subtasks.every((s) => s.status === "missed")).toBe(true);
    expect(summarize([t]).late).toBe(0);
    expect(urgentItems([t])).toHaveLength(0);
  });

  it("경계값: 30일 전은 지연, 31일 전은 지난 일", () => {
    const task: Task = {
      ...SPORTS,
      anchor: { mode: "date", date: "2026-09-11" },
      subtasks: [
        { id: "a", title: "30일 전", offsetDays: -35 }, // 8. 7. = 30일 전
        { id: "b", title: "31일 전", offsetDays: -36 }, // 8. 6. = 31일 전
      ],
    };
    const [t] = buildTasks({ ...base, tasks: [task], store: storeWith(), weekendAdjust: false });
    expect(t.subtasks[1].days).toBe(-30);
    expect(t.subtasks[1].status).toBe("late");
    expect(t.subtasks[0].days).toBe(-31);
    expect(t.subtasks[0].status).toBe("missed");
  });

  it("7일 안에 해야 하면 임박", () => {
    const [t] = buildTasks({ ...base, store: storeWith() });
    expect(t.subtasks[2].status).toBe("soon"); // 9. 11. = 5일 뒤
    expect(t.subtasks[2].days).toBe(5);
  });

  it("여유가 있으면 그냥 예정", () => {
    const [t] = buildTasks({ ...base, store: storeWith() });
    expect(t.subtasks[3].status).toBe("upcoming"); // 9. 16. = 10일 뒤
  });

  it("완료 표시하면 지연이든 임박이든 완료로 바뀐다", () => {
    const store = storeWith({ checks: { "sports-day::quote": true, "sports-day::run": true } });
    const [t] = buildTasks({ ...base, store });
    expect(t.subtasks[0].status).toBe("done");
    expect(t.subtasks[2].status).toBe("done");
  });

  it("오늘이 기한이면 지연이 아니라 임박이다", () => {
    const today = parseISO("2026-09-11")!;
    const [t] = buildTasks({ ...base, store: storeWith(), today });
    expect(t.subtasks[2].status).toBe("soon");
    expect(t.subtasks[2].days).toBe(0);
  });
});

describe("상단 요약", () => {
  it("지연·임박·완료 건수를 센다", () => {
    const store = storeWith({ checks: { "sports-day::quote": true } });
    const s = summarize(buildTasks({ ...base, store }));
    expect(s).toEqual({ late: 1, soon: 1, missed: 0, done: 1, total: 4 });
  });

  it("급한 것부터 날짜순으로 추린다", () => {
    const items = urgentItems(buildTasks({ ...base, store: storeWith() }));
    // 8. 12.(D-30)은 25일 전이라 지연, 함께 나온다
    expect(items.map((i) => i.subtask.dateText)).toEqual(["8. 12.(수)", "9. 4.(금)", "9. 11.(금)"]);
  });

  it("완료한 것은 급한 목록에 안 나온다", () => {
    const store = storeWith({ checks: { "sports-day::quote": true, "sports-day::notice": true } });
    const items = urgentItems(buildTasks({ ...base, store }));
    expect(items.map((i) => i.subtask.subtask.id)).toEqual(["run"]);
  });
});

describe("앵커가 바뀌면 전부 따라온다", () => {
  it("시트 확정일이 시드를 덮어쓴다", () => {
    const [t] = buildTasks({ ...base, store: storeWith(), sheetAnchors: { "sports-day": "2026-09-18" } });
    expect(t.anchorSource).toBe("sheet");
    expect(t.anchorText).toBe("9. 18.(금)");
    expect(t.subtasks.map((s) => s.dateText)).toEqual([
      "8. 19.(수)",
      "9. 11.(금)",
      "9. 18.(금)",
      "9. 23.(수)",
    ]);
  });

  it("일주일 미루면 하위 업무도 정확히 일주일씩 밀린다", () => {
    const before = buildTasks({ ...base, store: storeWith() })[0];
    const after = buildTasks({ ...base, store: storeWith(), sheetAnchors: { "sports-day": "2026-09-18" } })[0];
    before.subtasks.forEach((s, i) => {
      const diff = (after.subtasks[i].date.getTime() - s.date.getTime()) / 86_400_000;
      expect(diff).toBe(7);
    });
  });
});

describe("준비 기간을 고치면", () => {
  const store = storeWith({ overrides: { "sports-day": { offsets: { quote: -45 } } } });

  it("고친 값으로 계산한다", () => {
    const [t] = buildTasks({ ...base, store });
    const quote = t.subtasks.find((s) => s.subtask.id === "quote")!;
    expect(quote.dLabel).toBe("D-45");
    expect(quote.dateText).toBe("7. 28.(화)");
  });

  it("고친 항목임을 표시한다", () => {
    const [t] = buildTasks({ ...base, store });
    expect(t.subtasks.find((s) => s.subtask.id === "quote")!.customized).toBe(true);
    expect(t.subtasks.find((s) => s.subtask.id === "run")!.customized).toBe(false);
  });

  it("순서가 어긋나지 않게 날짜순으로 다시 세운다", () => {
    const flipped = storeWith({ overrides: { "sports-day": { offsets: { quote: -1 } } } });
    const [t] = buildTasks({ ...base, store: flipped });
    const dates = t.subtasks.map((s) => s.date.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });
});

describe("주말 보정 표시", () => {
  it("옮겨진 항목을 표시한다", () => {
    // 9. 11.(금) + 1 = 9. 12.(토) → 후행이므로 9. 14.(월)로 밀림
    const task: Task = { ...SPORTS, subtasks: [{ id: "x", title: "정산", offsetDays: 1 }] };
    const [t] = buildTasks({ ...base, tasks: [task], store: storeWith() });
    expect(t.subtasks[0].shifted).toBe(true);
    expect(t.subtasks[0].dateText).toBe("9. 14.(월)");
  });

  it("보정을 끄면 그대로 둔다", () => {
    const task: Task = { ...SPORTS, subtasks: [{ id: "x", title: "정산", offsetDays: 1 }] };
    const [t] = buildTasks({ ...base, tasks: [task], store: storeWith(), weekendAdjust: false });
    expect(t.subtasks[0].shifted).toBe(false);
    expect(t.subtasks[0].dateText).toBe("9. 12.(토)");
  });
});

describe("켜고 끄기", () => {
  it("꺼진 업무는 화면에 안 나온다", () => {
    const off: Task = { ...SPORTS, enabled: false };
    expect(buildTasks({ ...base, tasks: [off], store: storeWith() })).toHaveLength(0);
  });

  it("사용자가 켜면 나온다", () => {
    const off: Task = { ...SPORTS, enabled: false };
    const store = storeWith({ overrides: { "sports-day": { enabled: true } } });
    expect(buildTasks({ ...base, tasks: [off], store })).toHaveLength(1);
  });

  it("공모 사업은 기본으로 꺼져 있다", () => {
    for (const task of SEED_TASKS.filter((t) => t.category === "grant")) {
      expect(effectiveEnabled(task, undefined)).toBe(false);
    }
  });

  it("사용자가 직접 추가한 업무도 함께 나온다", () => {
    const mine: Task = { ...SPORTS, id: "mine", title: "우리 반 행사", category: "custom" };
    const store = storeWith({ customTasks: [mine] });
    expect(buildTasks({ ...base, store }).map((t) => t.task.id)).toEqual(["sports-day", "mine"]);
  });
});

describe("근거 확인 필요 표시", () => {
  it("법정 업무인데 근거가 없으면 경고 대상이다", () => {
    const views = buildTasks({ ...base, tasks: SEED_TASKS, store: storeWith() });
    const legal = views.filter((v) => v.task.category === "legal");
    expect(legal.length).toBeGreaterThan(0);
    expect(legal.every((v) => v.needsBasis)).toBe(true);
  });

  it("법정이 아닌 업무는 근거가 없어도 경고하지 않는다", () => {
    const [t] = buildTasks({ ...base, store: storeWith() });
    expect(t.needsBasis).toBe(false);
  });
});

describe("월별로 묶기", () => {
  it("3월부터 다음 해 2월까지 열두 달을 만든다", () => {
    const months = groupByMonth(buildTasks({ ...base, store: storeWith() }));
    expect(months.map((m) => m.month)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2]);
  });

  it("업무를 해당 달에 넣는다", () => {
    const months = groupByMonth(buildTasks({ ...base, store: storeWith() }));
    expect(months.find((m) => m.month === 9)!.tasks).toHaveLength(1);
    expect(months.find((m) => m.month === 3)!.tasks).toHaveLength(0);
  });

  it("졸업식은 1월 칸에 들어간다", () => {
    const months = groupByMonth(buildTasks({ ...base, tasks: SEED_TASKS, store: storeWith() }));
    const jan = months.find((m) => m.month === 1)!;
    expect(jan.tasks.map((t) => t.task.id)).toContain("graduation");
  });

  it("시드 27건이 빠짐없이 어느 달엔가 들어간다", () => {
    const views = buildTasks({ ...base, tasks: SEED_TASKS, store: storeWith() });
    const months = groupByMonth(views);
    const placed = months.reduce((sum, m) => sum + m.tasks.length, 0);
    expect(placed).toBe(views.length);
  });
});

describe("기안 제목은 복사해서 바로 쓸 수 있어야 한다", () => {
  it("「○○학년도」 자리를 실제 학년도로 채운다", () => {
    const task: Task = {
      ...SPORTS,
      subtasks: [
        { id: "q", title: "품의", offsetDays: -30, draftTitle: "○○학년도 가을 운동회 물품 구입 품의" },
      ],
    };
    const [t] = buildTasks({ ...base, tasks: [task], store: storeWith() });
    expect(t.subtasks[0].draftTitle).toBe("2026학년도 가을 운동회 물품 구입 품의");
  });

  it("기안 제목이 없으면 그대로 비워 둔다", () => {
    const [t] = buildTasks({ ...base, store: storeWith() });
    expect(t.subtasks[0].draftTitle).toBeUndefined();
  });

  it("시드의 기안 제목에 채우지 않은 자리가 남아 있지 않다", () => {
    const views = buildTasks({ ...base, tasks: SEED_TASKS, store: storeWith() });
    for (const v of views) {
      for (const s of v.subtasks) {
        expect(s.draftTitle ?? "", `${v.task.id}::${s.subtask.id}`).not.toContain("○○");
      }
    }
  });
});

describe("행사일 입력칸에 채울 값", () => {
  it("날짜로 지정된 업무", () => {
    const [t] = buildTasks({ ...base, store: storeWith() });
    expect(t.anchorISO).toBe("2026-09-11");
  });

  it("주차로 배치된 업무도 계산된 날짜가 들어간다", () => {
    // 비어 있으면 사용자는 화면에 날짜가 보이는데 입력칸만 빈 것을 본다
    const task: Task = { ...SPORTS, anchor: { mode: "week", month: 9, week: 2 } };
    const [t] = buildTasks({ ...base, tasks: [task], store: storeWith() });
    expect(t.anchorISO).toBe("2026-09-14");
    expect(t.anchorText).toBe("9. 14.(월)");
  });
});
