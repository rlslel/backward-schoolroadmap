import { describe, expect, it } from "vitest";
import {
  ALL,
  clearedFilter,
  describeFilter,
  filterMonths,
  filterTasks,
  isFiltering,
  matchesCategory,
  matchesDept,
  matchesGrade,
} from "./filter";
import { buildSampleData, sampleAnchors } from "./sample";
import { buildTasks, groupByMonth, summarize } from "./view";
import { createEmptyStore, defaultUi } from "./storage";
import { parseISO } from "./dates";
import { SEED_TASKS } from "../data/tasks.seed";
import type { Task, UiState } from "../types";

const TODAY = parseISO("2026-09-09")!;
const ui = (patch: Partial<UiState> = {}): UiState => ({ ...defaultUi(), dept: ALL, ...patch });

const 업무 = (patch: Partial<Task>): Task => ({
  id: "t",
  title: "업무",
  category: "annual",
  dept: "교무",
  anchor: { mode: "date", date: "2026-10-01" },
  enabled: true,
  subtasks: [{ id: "run", title: "실시", offsetDays: 0 }],
  ...patch,
});

describe("학년 필터", () => {
  it("고른 학년 업무를 본다", () => {
    expect(matchesGrade(업무({ grades: [6] }), 6)).toBe(true);
    expect(matchesGrade(업무({ grades: [6] }), 3)).toBe(false);
  });

  it("전 학년 업무는 어느 학년을 골라도 함께 나온다", () => {
    // 비어 있는 것을 「해당 없음」으로 처리하면 법정 업무가 통째로 사라진다
    expect(matchesGrade(업무({ grades: undefined }), 3)).toBe(true);
    expect(matchesGrade(업무({ grades: [] }), 3)).toBe(true);
  });

  it("전체를 고르면 다 나온다", () => {
    expect(matchesGrade(업무({ grades: [6] }), "all")).toBe(true);
  });
});

describe("부서·분류 필터", () => {
  it("부서로 거른다", () => {
    expect(matchesDept(업무({ dept: "체육" }), "체육")).toBe(true);
    expect(matchesDept(업무({ dept: "체육" }), "교무")).toBe(false);
    expect(matchesDept(업무({ dept: "체육" }), ALL)).toBe(true);
  });

  it("분류로 거른다", () => {
    expect(matchesCategory(업무({ category: "legal" }), "legal")).toBe(true);
    expect(matchesCategory(업무({ category: "legal" }), "annual")).toBe(false);
    expect(matchesCategory(업무({ category: "legal" }), "all")).toBe(true);
  });
});

describe("여러 필터를 함께 걸기", () => {
  const store = createEmptyStore(2026);
  const views = buildTasks({
    tasks: [
      업무({ id: "a", title: "체육 6학년", dept: "체육", grades: [6] }),
      업무({ id: "b", title: "체육 전 학년", dept: "체육" }),
      업무({ id: "c", title: "교무 법정", dept: "교무", category: "legal" }),
    ],
    store,
    sheetAnchors: {},
    today: TODAY,
  });

  it("부서와 학년을 함께 건다", () => {
    const r = filterTasks(views, ui({ dept: "체육", grade: 6 }));
    expect(r.map((v) => v.task.id).sort()).toEqual(["a", "b"]);
  });

  it("걸수록 좁아진다", () => {
    expect(filterTasks(views, ui())).toHaveLength(3);
    expect(filterTasks(views, ui({ dept: "체육" }))).toHaveLength(2);
    expect(filterTasks(views, ui({ dept: "체육", grade: 3 }))).toHaveLength(1);
  });

  it("맞는 것이 없으면 빈 목록", () => {
    expect(filterTasks(views, ui({ dept: "보건" }))).toHaveLength(0);
  });
});

describe("월 필터", () => {
  const views = buildTasks({
    tasks: [업무({ id: "a", anchor: { mode: "date", date: "2026-10-01" } })],
    store: createEmptyStore(2026),
    sheetAnchors: {},
    today: TODAY,
  });

  it("고른 달만 남긴다", () => {
    const months = filterMonths(groupByMonth(views), 10);
    expect(months).toHaveLength(1);
    expect(months[0].month).toBe(10);
  });

  it("전체를 고르면 열두 달이 다 남는다", () => {
    expect(filterMonths(groupByMonth(views), "all")).toHaveLength(12);
  });
});

describe("필터 상태 표시", () => {
  it("걸린 것이 있는지 안다", () => {
    expect(isFiltering(ui())).toBe(false);
    expect(isFiltering(ui({ grade: 3 }))).toBe(true);
  });

  it("무엇으로 걸렀는지 한 줄로 적는다", () => {
    expect(describeFilter(ui({ dept: "체육", grade: 6, category: "annual", month: 9 }))).toBe(
      "체육 · 6학년 · 통상 학사 · 9월",
    );
  });

  it("다 풀면 아무것도 안 걸린다", () => {
    expect(isFiltering(clearedFilter(ui({ dept: "체육", grade: 6 })))).toBe(false);
  });
});

describe("예시 데이터", () => {
  it("모든 업무에 확정일이 생긴다", () => {
    const anchors = sampleAnchors(SEED_TASKS, 2026);
    expect(Object.keys(anchors).length).toBe(SEED_TASKS.length);
  });

  it("빈 화면도 전부 완료된 화면도 아니다", () => {
    // 전부 비면 「지연 100건」이 되고, 전부 채우면 할 일이 없어 보인다
    const { store, anchors } = buildSampleData(SEED_TASKS, 2026, TODAY);
    const views = buildTasks({ tasks: SEED_TASKS, store, sheetAnchors: anchors, today: TODAY });
    const s = summarize(views);

    expect(s.done).toBeGreaterThan(0);
    expect(s.done).toBeLessThan(s.total);
    expect(s.late + s.soon).toBeGreaterThan(0);
  });

  it("공모 사업 하나를 켜서 학교마다 다르다는 것을 보여 준다", () => {
    const { store } = buildSampleData(SEED_TASKS, 2026, TODAY);
    expect(store.overrides["neulbom"]?.enabled).toBe(true);
  });

  it("회의체 예시가 들어 있다", () => {
    const { store } = buildSampleData(SEED_TASKS, 2026, TODAY);
    expect(store.meetings.length).toBeGreaterThan(0);
    expect(store.meetings.map((m) => m.id)).toEqual([...new Set(store.meetings.map((m) => m.id))]);
  });

  it("예시 데이터에도 성명이 들어가지 않는다", () => {
    const { store } = buildSampleData(SEED_TASKS, 2026, TODAY);
    const 전체 = JSON.stringify(store);
    for (const 말 of ["성명", "연락처", "학번"]) expect(전체).not.toContain(말);
  });
});
