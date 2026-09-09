import { describe, expect, it } from "vitest";
import {
  DEFAULT_SUBTASKS,
  addCustomTask,
  buildCustomTask,
  disabledSeedTasks,
  makeCustomTaskId,
  offByDefaultTasks,
  removeCustomTask,
  setEnabled,
  validateCustomTask,
  type CustomTaskInput,
} from "./customTask";
import { createEmptyStore } from "./storage";
import { buildTasks } from "./view";
import { parseISO } from "./dates";
import { SEED_TASKS } from "../data/tasks.seed";
import type { Store } from "../types";

const TODAY = parseISO("2026-09-09")!;

const input: CustomTaskInput = {
  title: "우리 학교 독서 축제",
  dept: "연구",
  date: "2026-10-15",
  subtasks: [
    { title: "운영 계획 수립", offsetDays: -21 },
    { title: "행사 실시", offsetDays: 0 },
  ],
};

describe("입력 확인", () => {
  it("제대로 적으면 통과한다", () => {
    expect(validateCustomTask(input).ok).toBe(true);
  });

  it("이름이 없으면 알려 준다", () => {
    const r = validateCustomTask({ ...input, title: "   " });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("업무 이름");
  });

  it("행사일이 없으면 알려 준다", () => {
    expect(validateCustomTask({ ...input, date: "" }).errors[0]).toContain("행사일");
  });

  it("준비 항목이 하나도 없으면 알려 준다", () => {
    const r = validateCustomTask({ ...input, subtasks: [{ title: "  ", offsetDays: 0 }] });
    expect(r.errors[0]).toContain("준비 항목");
  });

  it("날짜 간격이 숫자가 아니면 알려 준다", () => {
    const r = validateCustomTask({ ...input, subtasks: [{ title: "품의", offsetDays: NaN }] });
    expect(r.errors.some((e) => e.includes("숫자"))).toBe(true);
  });

  it("1년을 넘는 간격은 막는다", () => {
    const r = validateCustomTask({ ...input, subtasks: [{ title: "품의", offsetDays: -400 }] });
    expect(r.errors.some((e) => e.includes("1년"))).toBe(true);
  });

  it("여러 군데가 틀리면 전부 알려 준다", () => {
    const r = validateCustomTask({ title: "", dept: "", date: "", subtasks: [] });
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("업무 만들기", () => {
  it("분류는 학교 자율로 고정한다", () => {
    expect(buildCustomTask(input, new Set()).category).toBe("custom");
  });

  it("앞뒤 공백을 정리한다", () => {
    const task = buildCustomTask({ ...input, title: "  독서 축제  " }, new Set());
    expect(task.title).toBe("독서 축제");
  });

  it("빈 준비 항목은 버린다", () => {
    const task = buildCustomTask(
      { ...input, subtasks: [...input.subtasks, { title: "   ", offsetDays: 5 }] },
      new Set(),
    );
    expect(task.subtasks).toHaveLength(2);
  });

  it("준비 항목을 날짜순으로 세운다", () => {
    const task = buildCustomTask(
      {
        ...input,
        subtasks: [
          { title: "정산", offsetDays: 5 },
          { title: "계획", offsetDays: -30 },
          { title: "실시", offsetDays: 0 },
        ],
      },
      new Set(),
    );
    expect(task.subtasks.map((s) => s.title)).toEqual(["계획", "실시", "정산"]);
  });

  it("하위 업무 id 가 겹치지 않는다", () => {
    const task = buildCustomTask(input, new Set());
    const ids = task.subtasks.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("업무 id 가 기존 것과 겹치지 않는다", () => {
    const now = 1_700_000_000_000;
    const first = makeCustomTaskId(new Set(), now);
    const second = makeCustomTaskId(new Set([first]), now);
    expect(second).not.toBe(first);
  });

  it("시드 id 와도 겹치지 않는다", () => {
    const seedIds = new Set(SEED_TASKS.map((t) => t.id));
    expect(seedIds.has(buildCustomTask(input, seedIds).id)).toBe(false);
  });

  it("만든 업무가 화면에 바로 나온다", () => {
    const store = addCustomTask(createEmptyStore(2026), buildCustomTask(input, new Set()));
    const views = buildTasks({ tasks: [], store, sheetAnchors: {}, today: TODAY });
    expect(views).toHaveLength(1);
    expect(views[0].task.title).toBe("우리 학교 독서 축제");
    expect(views[0].anchorText).toBe("10. 15.(목)");
  });

  it("기본 준비 절차가 날짜순으로 정리되어 있다", () => {
    const offsets = DEFAULT_SUBTASKS.map((s) => s.offsetDays);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(DEFAULT_SUBTASKS.some((s) => s.offsetDays === 0)).toBe(true);
  });
});

describe("끄고 켜기", () => {
  it("끄면 화면에서 사라진다", () => {
    const store = setEnabled(createEmptyStore(2026), "sports-day", false);
    const views = buildTasks({ tasks: SEED_TASKS, store, sheetAnchors: {}, today: TODAY });
    expect(views.some((v) => v.task.id === "sports-day")).toBe(false);
  });

  it("다시 켜면 돌아온다", () => {
    let store: Store = setEnabled(createEmptyStore(2026), "sports-day", false);
    store = setEnabled(store, "sports-day", true);
    const views = buildTasks({ tasks: SEED_TASKS, store, sheetAnchors: {}, today: TODAY });
    expect(views.some((v) => v.task.id === "sports-day")).toBe(true);
  });

  it("껐다 켜도 체크 표시는 남는다", () => {
    let store: Store = { ...createEmptyStore(2026), checks: { "sports-day::quote": true } };
    store = setEnabled(store, "sports-day", false);
    store = setEnabled(store, "sports-day", true);
    expect(store.checks["sports-day::quote"]).toBe(true);
  });

  it("끈 업무를 목록으로 보여 준다", () => {
    const store = setEnabled(createEmptyStore(2026), "school-trip", false);
    expect(disabledSeedTasks(store, SEED_TASKS).map((t) => t.id)).toEqual(["school-trip"]);
  });

  it("원래 꺼져 있던 공모 사업은 「내가 끈 것」에 안 들어간다", () => {
    const store = createEmptyStore(2026);
    expect(disabledSeedTasks(store, SEED_TASKS)).toHaveLength(0);
    expect(offByDefaultTasks(store, SEED_TASKS).map((t) => t.id)).toContain("neulbom");
  });

  it("공모 사업을 켜면 켜야 할 목록에서 빠진다", () => {
    const store = setEnabled(createEmptyStore(2026), "neulbom", true);
    expect(offByDefaultTasks(store, SEED_TASKS).map((t) => t.id)).not.toContain("neulbom");
  });
});

describe("직접 추가한 업무 지우기", () => {
  it("목록에서 빠진다", () => {
    const task = buildCustomTask(input, new Set());
    let store: Store = addCustomTask(createEmptyStore(2026), task);
    store = removeCustomTask(store, task.id);
    expect(store.customTasks).toHaveLength(0);
  });

  it("딸린 체크 표시도 함께 지운다", () => {
    // 남겨 두면 나중에 같은 id 가 생겼을 때 엉뚱한 체크가 되살아난다
    const task = buildCustomTask(input, new Set());
    let store: Store = addCustomTask(createEmptyStore(2026), task);
    store = { ...store, checks: { [`${task.id}::s1`]: true, "sports-day::quote": true } };
    store = removeCustomTask(store, task.id);
    expect(store.checks).toEqual({ "sports-day::quote": true });
  });

  it("다른 업무의 체크는 건드리지 않는다", () => {
    const task = buildCustomTask(input, new Set());
    let store: Store = addCustomTask(createEmptyStore(2026), task);
    store = { ...store, checks: { "sports-day::quote": true } };
    store = removeCustomTask(store, task.id);
    expect(store.checks["sports-day::quote"]).toBe(true);
  });

  it("수정해 둔 내용도 함께 정리한다", () => {
    const task = buildCustomTask(input, new Set());
    let store: Store = addCustomTask(createEmptyStore(2026), task);
    store = setEnabled(store, task.id, false);
    store = removeCustomTask(store, task.id);
    expect(store.overrides[task.id]).toBeUndefined();
  });
});
