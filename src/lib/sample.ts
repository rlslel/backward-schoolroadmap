// 「예시 데이터로 둘러보기」.
//
// 처음 여는 사람은 시트도 없고 체크도 없어서 빈 화면을 본다. 그러면 이 앱이 무엇을 하는지
// 알 수가 없다. 진짜처럼 채워진 화면을 한 번 보여 주고, 언제든 지울 수 있게 한다.
//
// 여기 들어가는 값은 전부 가상이다. 실제 학교 자료가 아니다.

import { resolveDate, toISO } from "./dates";
import { addMeeting, buildMeeting } from "./meeting";
import { createEmptyStore } from "./storage";
import { checkKey, type Store, type Task } from "../types";

/**
 * 시드의 주차 배치를 실제 날짜로 바꿔 「학교가 확정한 일정」인 것처럼 만든다.
 * 시트를 연결하지 않아도 확정일이 있는 화면을 볼 수 있다.
 */
export function sampleAnchors(tasks: Task[], schoolYear: number): Record<string, string> {
  const anchors: Record<string, string> = {};
  for (const task of tasks) {
    const resolved = resolveDate(task.anchor, 0, schoolYear, false);
    if (resolved) anchors[task.id] = toISO(resolved.date);
  }
  return anchors;
}

/**
 * 지난 항목 대부분과 임박한 항목 일부를 완료 처리한다.
 * 전부 비어 있으면 「지연 100건」이 되고, 전부 채우면 할 일이 없어 보인다.
 * 실제로 일하는 중인 학교처럼 보이는 것이 목적이다.
 */
function sampleChecks(tasks: Task[], anchors: Record<string, string>, schoolYear: number, today: Date) {
  const checks: Record<string, boolean> = {};
  let n = 0;

  for (const task of tasks) {
    const anchor = anchors[task.id] ? ({ mode: "date", date: anchors[task.id] } as const) : task.anchor;
    for (const sub of task.subtasks) {
      const resolved = resolveDate(anchor, sub.offsetDays, schoolYear, true);
      if (!resolved) continue;

      const 지났나 = resolved.date.getTime() < today.getTime();
      n += 1;
      // 지난 것은 대부분 했고, 몇 개는 빠뜨린 것처럼 남겨 둔다
      if (지났나 && n % 7 !== 0) checks[checkKey(task.id, sub.id)] = true;
    }
  }

  return checks;
}

/** 어느 학교에나 있을 법한 회의체 몇 개. 이름은 학교가 바꿔 쓰면 된다. */
const SAMPLE_MEETINGS = [
  { name: "기획회의", note: "격주 월요일", depts: [], grades: [], taskIds: [] },
  { name: "3학년 동학년 협의", note: "매주 화요일", depts: [], grades: [3], taskIds: [] },
];

export interface SampleData {
  store: Store;
  anchors: Record<string, string>;
}

export function buildSampleData(tasks: Task[], schoolYear: number, today: Date): SampleData {
  const anchors = sampleAnchors(tasks, schoolYear);

  let store = createEmptyStore(schoolYear);
  store = { ...store, checks: sampleChecks(tasks, anchors, schoolYear, today) };

  // 공모 사업 하나를 켜 둔다. 학교마다 다르다는 것을 보여 주기 위해서다.
  store = { ...store, overrides: { neulbom: { enabled: true } } };

  for (const m of SAMPLE_MEETINGS) {
    const used = new Set(store.meetings.map((x) => x.id));
    store = addMeeting(store, buildMeeting(m, used, Date.now() + store.meetings.length));
  }

  return { store, anchors };
}
