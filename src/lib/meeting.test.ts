import { describe, expect, it } from "vitest";
import {
  ALL_MEETING_ID,
  addMeeting,
  allMeetings,
  buildMeeting,
  builtinMeetings,
  deptMeetingId,
  describeScope,
  filterByMeeting,
  findMeeting,
  isBuiltin,
  matchesMeeting,
  removeMeeting,
  validateMeeting,
  type MeetingInput,
} from "./meeting";
import { createEmptyStore } from "./storage";
import { buildTasks } from "./view";
import { parseISO } from "./dates";
import type { MeetingBody, Store, Task } from "../types";

const TODAY = parseISO("2026-09-09")!;

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

const 회의 = (patch: Partial<MeetingBody>): MeetingBody => ({
  id: "m",
  name: "회의",
  depts: [],
  grades: [],
  taskIds: [],
  ...patch,
});

describe("기본 회의체", () => {
  it("전체 하나와 부서별 하나씩을 만든다", () => {
    const list = builtinMeetings(["교무", "체육"]);
    expect(list.map((m) => m.name)).toEqual(["전체", "교무", "체육"]);
  });

  it("기본 회의체는 지울 수 없는 것으로 구분한다", () => {
    const [전체, 교무] = builtinMeetings(["교무"]);
    expect(isBuiltin(전체)).toBe(true);
    expect(isBuiltin(교무)).toBe(true);
    expect(isBuiltin(회의({ id: "meet-abc" }))).toBe(false);
  });

  it("학교가 만든 회의체가 뒤에 붙는다", () => {
    const store = addMeeting(createEmptyStore(2026), 회의({ id: "meet-1", name: "미래두레" }));
    expect(allMeetings(store, ["교무"]).map((m) => m.name)).toEqual(["전체", "교무", "미래두레"]);
  });

  it("없는 회의를 고르면 전체로 되돌린다", () => {
    const store = createEmptyStore(2026);
    expect(findMeeting(store, ["교무"], "지워진회의").id).toBe(ALL_MEETING_ID);
    expect(findMeeting(store, ["교무"], undefined).id).toBe(ALL_MEETING_ID);
  });
});

describe("어떤 업무를 다룰 것인가", () => {
  it("범위를 안 정하면 전체를 본다", () => {
    expect(matchesMeeting(업무({}), 회의({}))).toBe(true);
  });

  it("부서로 거른다", () => {
    const 미래두레 = 회의({ depts: ["정보"] });
    expect(matchesMeeting(업무({ dept: "정보" }), 미래두레)).toBe(true);
    expect(matchesMeeting(업무({ dept: "교무" }), 미래두레)).toBe(false);
  });

  it("부서 여러 개를 묶을 수 있다", () => {
    const 두레 = 회의({ depts: ["연구", "정보"] });
    expect(matchesMeeting(업무({ dept: "연구" }), 두레)).toBe(true);
    expect(matchesMeeting(업무({ dept: "정보" }), 두레)).toBe(true);
    expect(matchesMeeting(업무({ dept: "체육" }), 두레)).toBe(false);
  });

  it("학년으로 거른다", () => {
    const 교실마실 = 회의({ grades: [3] });
    expect(matchesMeeting(업무({ grades: [3] }), 교실마실)).toBe(true);
    expect(matchesMeeting(업무({ grades: [6] }), 교실마실)).toBe(false);
  });

  it("학년 회의는 전 학년 공통 업무도 함께 본다", () => {
    // 학년이 비어 있는 것을 「해당 없음」으로 처리하면 법정 업무가 통째로 빠진다
    const 교실마실 = 회의({ grades: [3] });
    expect(matchesMeeting(업무({ grades: undefined }), 교실마실)).toBe(true);
    expect(matchesMeeting(업무({ grades: [] }), 교실마실)).toBe(true);
  });

  it("직접 고른 업무는 부서·학년과 상관없이 들어온다", () => {
    const 기획 = 회의({ depts: ["체육"], taskIds: ["special"] });
    expect(matchesMeeting(업무({ id: "special", dept: "교무" }), 기획)).toBe(true);
  });

  it("부서와 학년을 함께 쓰면 둘 중 하나만 걸려도 들어온다", () => {
    const 섞음 = 회의({ depts: ["정보"], grades: [1] });
    expect(matchesMeeting(업무({ dept: "정보", grades: [6] }), 섞음)).toBe(true);
    expect(matchesMeeting(업무({ dept: "교무", grades: [1] }), 섞음)).toBe(true);
    expect(matchesMeeting(업무({ dept: "교무", grades: [6] }), 섞음)).toBe(false);
  });
});

describe("실제 화면 목록에 적용", () => {
  const store = createEmptyStore(2026);
  const views = buildTasks({
    tasks: [
      업무({ id: "a", title: "정보 업무", dept: "정보" }),
      업무({ id: "b", title: "6학년 수학여행", dept: "교무", grades: [6] }),
      업무({ id: "c", title: "전 학년 안전교육", dept: "생활" }),
    ],
    store,
    sheetAnchors: {},
    today: TODAY,
  });

  it("부서 회의는 그 부서 것만", () => {
    const r = filterByMeeting(views, 회의({ depts: ["정보"] }));
    expect(r.map((v) => v.task.id)).toEqual(["a"]);
  });

  it("6학년 회의는 6학년 업무와 전 학년 업무를 함께", () => {
    const r = filterByMeeting(views, 회의({ grades: [6] }));
    expect(r.map((v) => v.task.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("전체 회의는 다 본다", () => {
    expect(filterByMeeting(views, 회의({}))).toHaveLength(3);
  });
});

describe("회의체 만들기", () => {
  const input: MeetingInput = {
    name: "미래두레",
    note: "매주 화요일",
    depts: ["정보"],
    grades: [],
    taskIds: [],
  };

  it("이름이 없으면 막는다", () => {
    expect(validateMeeting({ ...input, name: "  " }, [])[0]).toContain("회의 이름");
  });

  it("이름이 겹치면 막는다", () => {
    const 기존 = [회의({ name: "미래두레" })];
    expect(validateMeeting(input, 기존)[0]).toContain("이미 있습니다");
  });

  it("제대로 적으면 통과한다", () => {
    expect(validateMeeting(input, [])).toEqual([]);
  });

  it("만든 회의에 값이 담긴다", () => {
    const m = buildMeeting(input, new Set());
    expect(m.name).toBe("미래두레");
    expect(m.note).toBe("매주 화요일");
    expect(m.depts).toEqual(["정보"]);
  });

  it("비고를 비우면 아예 담지 않는다", () => {
    expect(buildMeeting({ ...input, note: "   " }, new Set()).note).toBeUndefined();
  });

  it("학년을 순서대로 정리한다", () => {
    const m = buildMeeting({ ...input, grades: [6, 1, 3] }, new Set());
    expect(m.grades).toEqual([1, 3, 6]);
  });

  it("id 가 겹치지 않는다", () => {
    const now = 1_700_000_000_000;
    const a = buildMeeting(input, new Set(), now);
    const b = buildMeeting(input, new Set([a.id]), now);
    expect(b.id).not.toBe(a.id);
  });
});

describe("회의체 지우기", () => {
  it("목록에서 빠진다", () => {
    const m = 회의({ id: "meet-1", name: "미래두레" });
    let store: Store = addMeeting(createEmptyStore(2026), m);
    store = removeMeeting(store, m.id);
    expect(store.meetings).toHaveLength(0);
  });

  it("보고 있던 회의를 지우면 전체로 되돌린다", () => {
    // 지운 회의를 계속 고른 상태로 두면 빈 화면이 된다
    const m = 회의({ id: "meet-1", name: "미래두레" });
    let store: Store = addMeeting(createEmptyStore(2026), m);
    store = { ...store, ui: { ...store.ui, meetingId: m.id } };
    store = removeMeeting(store, m.id);
    expect(store.ui.meetingId).toBeUndefined();
  });

  it("다른 회의를 보고 있으면 그대로 둔다", () => {
    const m = 회의({ id: "meet-1" });
    let store: Store = addMeeting(createEmptyStore(2026), m);
    store = { ...store, ui: { ...store.ui, meetingId: deptMeetingId("교무") } };
    store = removeMeeting(store, m.id);
    expect(store.ui.meetingId).toBe(deptMeetingId("교무"));
  });
});

describe("범위 설명", () => {
  it("사람이 읽을 수 있게 적는다", () => {
    expect(describeScope(회의({}))).toBe("전체 업무");
    expect(describeScope(회의({ depts: ["연구", "정보"] }))).toBe("연구·정보");
    expect(describeScope(회의({ grades: [3] }))).toBe("3학년");
    expect(describeScope(회의({ depts: ["정보"], grades: [1, 2] }))).toBe("정보 + 1·2학년");
    expect(describeScope(회의({ taskIds: ["a", "b"] }))).toBe("직접 고른 업무 2건");
  });
});
