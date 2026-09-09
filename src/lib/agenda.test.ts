import { describe, expect, it } from "vitest";
import { agendaTitle, deptsOf, meetingAgenda, pendingDecisions, schoolDepts, upcomingAcademic } from "./agenda";
import type { MeetingBody } from "../types";

const 전체회의: MeetingBody = { id: "all", name: "전체", depts: [], grades: [], taskIds: [] };
const 부서회의 = (dept: string): MeetingBody => ({
  id: `d-${dept}`,
  name: dept,
  depts: [dept],
  grades: [],
  taskIds: [],
});
import { buildTasks } from "./view";
import { createEmptyStore } from "./storage";
import { parseISO } from "./dates";
import { SEED_TASKS } from "../data/tasks.seed";
import type { Task } from "../types";

const TODAY = parseISO("2026-09-08")!;
const store = createEmptyStore(2026);

const 운동회: Task = {
  id: "sports-day",
  title: "가을 운동회",
  category: "annual",
  dept: "체육",
  anchor: { mode: "date", date: "2026-09-25" },
  enabled: true,
  subtasks: [
    { id: "plan", title: "계획 수립", offsetDays: -30 }, // 8. 26. → 13일 전
    { id: "quote", title: "물품 품의", offsetDays: -14 }, // 9. 11. → 3일 뒤
    { id: "run", title: "실시", offsetDays: 0 }, // 9. 25. → 17일 뒤
    { id: "settle", title: "정산", offsetDays: 60 }, // 한참 뒤
  ],
};

const 연수: Task = {
  id: "edu",
  title: "안전교육",
  category: "legal",
  dept: "생활",
  anchor: { mode: "date", date: "2026-09-18" },
  enabled: true,
  subtasks: [{ id: "run", title: "교육 실시", offsetDays: 0 }],
};

const views = buildTasks({ tasks: [운동회, 연수], store, sheetAnchors: {}, today: TODAY });

describe("부서 목록", () => {
  it("업무가 있는 부서만 모은다", () => {
    expect(deptsOf(views)).toEqual(["생활", "체육"]);
  });

  it("회의체를 만들 때는 시드의 부서를 전부 쓴다", () => {
    // 공모 사업만 있는 부서는 그 사업이 꺼져 있으면 화면에 안 나온다.
    // 그렇다고 목록에서 빼면 그 부서로 회의체를 만들 수조차 없다.
    const list = schoolDepts(["공통", "정보", "방과후"], []);
    expect(list).toContain("정보");
    expect(list).toContain("방과후");
  });

  it("직접 추가한 업무의 부서도 합친다", () => {
    expect(schoolDepts(["공통"], [{ dept: "도서관" }])).toEqual(["공통", "도서관"]);
  });

  it("빈 부서 이름은 넣지 않는다", () => {
    expect(schoolDepts(["공통"], [{ dept: "  " }])).toEqual(["공통"]);
  });
});

describe("부서 회의 안건", () => {
  it("고른 회의 것만 올린다", () => {
    const agenda = meetingAgenda(views, 부서회의("체육"));
    expect(agenda.map((e) => e.task.task.id)).toEqual(["sports-day"]);
  });

  it("전체 회의는 모든 부서를 올린다", () => {
    expect(meetingAgenda(views, 전체회의)).toHaveLength(2);
  });

  it("한 달 안의 항목만 담는다", () => {
    const [entry] = meetingAgenda(views, 부서회의("체육"));
    // 계획 수립(지연) · 물품 품의(3일 뒤) · 실시(17일 뒤)는 담고, 정산(60일 뒤)은 뺀다
    expect(entry.items.map((i) => i.subtask.id)).toEqual(["plan", "quote", "run"]);
  });

  it("이미 완료한 항목은 안건에서 뺀다", () => {
    const done = { ...store, checks: { "sports-day::plan": true } };
    const v = buildTasks({ tasks: [운동회], store: done, sheetAnchors: {}, today: TODAY });
    const [entry] = meetingAgenda(v, 부서회의("체육"));
    expect(entry.items.map((i) => i.subtask.id)).toEqual(["quote", "run"]);
  });

  it("한참 지난 항목은 안건에서 뺀다", () => {
    // 회의에서 다룰 수 있는 것만 올린다
    const 봄: Task = { ...운동회, anchor: { mode: "date", date: "2026-05-08" } };
    const v = buildTasks({ tasks: [봄], store, sheetAnchors: {}, today: TODAY });
    expect(meetingAgenda(v, 부서회의("체육"))).toHaveLength(0);
  });

  it("다룰 것이 없는 업무는 아예 안 올린다", () => {
    const 먼일: Task = {
      ...운동회,
      subtasks: [{ id: "x", title: "먼 일", offsetDays: 200 }],
    };
    const v = buildTasks({ tasks: [먼일], store, sheetAnchors: {}, today: TODAY });
    expect(meetingAgenda(v, 부서회의("체육"))).toHaveLength(0);
  });

  it("급한 것부터 순서대로 올린다", () => {
    const agenda = meetingAgenda(views, 전체회의);
    const first = agenda[0].items[0].date.getTime();
    const second = agenda[1].items[0].date.getTime();
    expect(first).toBeLessThanOrEqual(second);
  });
});

describe("통상학사 — 앞으로 한 달", () => {
  it("연례 행사만 고른다", () => {
    expect(upcomingAcademic(views, TODAY).map((v) => v.task.id)).toEqual(["sports-day"]);
  });

  it("이미 지난 행사는 안 넣는다", () => {
    const 지난: Task = { ...운동회, anchor: { mode: "date", date: "2026-08-01" } };
    const v = buildTasks({ tasks: [지난], store, sheetAnchors: {}, today: TODAY });
    expect(upcomingAcademic(v, TODAY)).toHaveLength(0);
  });

  it("한 달 넘게 남은 행사는 안 넣는다", () => {
    const 먼: Task = { ...운동회, anchor: { mode: "date", date: "2026-11-20" } };
    const v = buildTasks({ tasks: [먼], store, sheetAnchors: {}, today: TODAY });
    expect(upcomingAcademic(v, TODAY)).toHaveLength(0);
  });

  it("행사일 순서로 준다", () => {
    const 둘: Task = { ...운동회, id: "b", title: "다른 행사", anchor: { mode: "date", date: "2026-09-12" } };
    const v = buildTasks({ tasks: [운동회, 둘], store, sheetAnchors: {}, today: TODAY });
    expect(upcomingAcademic(v, TODAY).map((x) => x.task.id)).toEqual(["b", "sports-day"]);
  });
});

describe("정해야 할 것", () => {
  it("시트에 날짜가 없으면 「날짜 미확정」으로 올린다", () => {
    const 미확정: Task = { ...운동회, anchor: { mode: "week", month: 10, week: 1 } };
    const v = buildTasks({ tasks: [미확정], store, sheetAnchors: {}, today: TODAY });
    const list = pendingDecisions(v, TODAY);
    expect(list.map((p) => p.reasons)).toEqual([["날짜 미확정"]]);
  });

  it("시트에 날짜가 있으면 올리지 않는다", () => {
    const 미확정: Task = { ...운동회, anchor: { mode: "week", month: 10, week: 1 } };
    const v = buildTasks({
      tasks: [미확정],
      store,
      sheetAnchors: { "sports-day": "2026-10-05" },
      today: TODAY,
    });
    expect(pendingDecisions(v, TODAY)).toHaveLength(0);
  });

  it("법정 업무인데 근거가 없으면 올린다", () => {
    const list = pendingDecisions(views, TODAY);
    expect(list.some((p) => p.view.task.id === "edu" && p.reasons.includes("근거 확인 필요"))).toBe(true);
  });

  it("이미 지난 행사는 이제 와서 정할 것이 없으므로 뺀다", () => {
    const 지난: Task = { ...연수, anchor: { mode: "date", date: "2026-08-01" } };
    const v = buildTasks({ tasks: [지난], store, sheetAnchors: {}, today: TODAY });
    expect(pendingDecisions(v, TODAY)).toHaveLength(0);
  });

  it("한 업무에 두 가지가 겹쳐도 줄은 하나만 만든다", () => {
    // 같은 업무가 두 번 나오면 잘못된 것처럼 보인다
    const 둘다: Task = { ...연수, anchor: { mode: "week", month: 10, week: 2 } };
    const v = buildTasks({ tasks: [둘다], store, sheetAnchors: {}, today: TODAY });
    const list = pendingDecisions(v, TODAY);
    expect(list).toHaveLength(1);
    expect(list[0].reasons).toEqual(["날짜 미확정", "근거 확인 필요"]);
  });

  it("업무 하나가 두 번 나오지 않는다", () => {
    const v = buildTasks({ tasks: SEED_TASKS, store, sheetAnchors: {}, today: TODAY });
    const ids = pendingDecisions(v, TODAY).map((p) => p.view.task.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("시드 전체를 넣어도 계산된다", () => {
    const v = buildTasks({ tasks: SEED_TASKS, store, sheetAnchors: {}, today: TODAY });
    const list = pendingDecisions(v, TODAY);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.view.anchorDate.getTime() >= 0)).toBe(true);
  });
});

describe("인쇄물 제목", () => {
  it("학년도·월·부서를 넣는다", () => {
    expect(agendaTitle(2026, TODAY, "미래두레")).toBe("2026학년도 9월 미래두레 협의 안건");
  });

  it("전체를 고르면 전체로 적는다", () => {
    expect(agendaTitle(2026, TODAY, "전체")).toBe("2026학년도 9월 전체 협의 안건");
  });
});
