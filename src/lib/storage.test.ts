import { beforeEach, describe, expect, it } from "vitest";
import {
  STORAGE_KEY,
  clearStore,
  createEmptyStore,
  createMemoryStorage,
  loadStore,
  pruneNotice,
  pruneStore,
  saveStore,
  type StorageLike,
} from "./storage";
import { checkKey } from "../types";

let storage: StorageLike;
beforeEach(() => {
  storage = createMemoryStorage();
});

/** 저장·읽기가 항상 실패하는 저장소. 시크릿 모드나 차단된 학교 PC를 흉내낸다. */
function brokenStorage(): StorageLike {
  return {
    getItem() {
      throw new Error("차단됨");
    },
    setItem() {
      throw new Error("차단됨");
    },
    removeItem() {
      throw new Error("차단됨");
    },
  };
}

describe("처음 실행", () => {
  it("저장된 것이 없으면 빈 상태로 시작하고 아무 말도 하지 않는다", () => {
    const r = loadStore(storage, 2026);
    expect(r.status).toBe("empty");
    expect(r.notice).toBeUndefined();
    expect(r.store.schoolYear).toBe(2026);
    expect(r.store.v).toBe(1);
  });
});

describe("저장하고 다시 읽기", () => {
  it("체크와 필터가 그대로 남는다", () => {
    const store = createEmptyStore(2026);
    store.checks[checkKey("sports-day", "quote")] = true;
    store.ui = { dept: "체육", grade: 5, category: "annual", month: 9 };
    store.sheetUrl = "https://docs.google.com/spreadsheets/d/e/x/pub?output=csv";
    expect(saveStore(storage, store)).toBe(true);

    const r = loadStore(storage, 2026);
    expect(r.status).toBe("ok");
    expect(r.store.checks["sports-day::quote"]).toBe(true);
    expect(r.store.ui).toEqual({ dept: "체육", grade: 5, category: "annual", month: 9 });
    expect(r.store.sheetUrl).toContain("output=csv");
  });

  it("전체 삭제하면 처음 상태로 돌아간다", () => {
    const store = createEmptyStore(2026);
    store.checks["a::b"] = true;
    saveStore(storage, store);
    clearStore(storage);

    const r = loadStore(storage, 2026);
    expect(r.status).toBe("empty");
    expect(r.store.checks).toEqual({});
  });
});

describe("스키마 버전 검증", () => {
  it("버전이 다르면 초기화하고 사용자에게 알린다", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, schoolYear: 2026, checks: { "a::b": true } }));
    const r = loadStore(storage, 2026);
    expect(r.status).toBe("reset");
    expect(r.notice).toBeTruthy();
    expect(r.store.checks).toEqual({});
  });

  it("버전이 없어도 초기화한다", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ schoolYear: 2026 }));
    expect(loadStore(storage, 2026).status).toBe("reset");
  });
});

describe("내용이 깨져 있어도 앱이 죽지 않는다", () => {
  it("JSON 이 아니면 초기화한다", () => {
    storage.setItem(STORAGE_KEY, "이건 JSON 이 아니다");
    const r = loadStore(storage, 2026);
    expect(r.status).toBe("reset");
    expect(r.notice).toBeTruthy();
  });

  it("일부 항목만 깨져 있으면 그 부분만 기본값으로 되돌린다", () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        v: 1,
        schoolYear: 2026,
        checks: "망가짐",
        overrides: null,
        customTasks: "배열이 아님",
        ui: { dept: 123, grade: "이상한값", month: "또이상한값" },
      }),
    );
    const r = loadStore(storage, 2026);
    expect(r.status).toBe("ok");
    expect(r.store.checks).toEqual({});
    expect(r.store.overrides).toEqual({});
    expect(r.store.customTasks).toEqual([]);
    expect(r.store.ui).toEqual({ dept: "전체", grade: "all", category: "all", month: "all" });
  });

  it("배열이나 null 을 넣어도 버틴다", () => {
    for (const junk of ["[1,2,3]", "null", '"글자"', "42"]) {
      storage.setItem(STORAGE_KEY, junk);
      expect(loadStore(storage, 2026).status).toBe("reset");
    }
  });
});

describe("저장이 막힌 브라우저", () => {
  it("앱이 죽지 않고 안내 문구를 돌려준다", () => {
    const r = loadStore(brokenStorage(), 2026);
    expect(r.status).toBe("unavailable");
    expect(r.notice).toContain("저장이 되지 않아");
    expect(r.store.v).toBe(1);
  });

  it("저장소가 아예 없어도 마찬가지다", () => {
    expect(loadStore(null, 2026).status).toBe("unavailable");
  });

  it("저장 실패는 예외를 던지지 않고 false 를 돌려준다", () => {
    expect(saveStore(brokenStorage(), createEmptyStore(2026))).toBe(false);
    expect(saveStore(null, createEmptyStore(2026))).toBe(false);
    expect(() => clearStore(brokenStorage())).not.toThrow();
  });
});

describe("사라진 업무 정리", () => {
  const validTasks = new Set(["sports-day"]);
  const validChecks = new Set(["sports-day::quote"]);

  it("현재 목록에 있는 것만 남긴다", () => {
    const store = createEmptyStore(2026);
    store.checks = { "sports-day::quote": true, "gone-task::old": true };
    store.overrides = { "sports-day": { enabled: true }, "gone-task": { enabled: false } };

    const r = pruneStore(store, validTasks, validChecks);
    expect(r.store.checks).toEqual({ "sports-day::quote": true });
    expect(Object.keys(r.store.overrides)).toEqual(["sports-day"]);
    expect(r.droppedChecks).toBe(1);
    expect(r.droppedOverrides).toBe(1);
  });

  it("버린 것이 있으면 사용자에게 알린다", () => {
    const store = createEmptyStore(2026);
    store.checks = { "gone::a": true, "gone::b": true };
    const notice = pruneNotice(pruneStore(store, validTasks, validChecks));
    expect(notice).toContain("2개 항목");
  });

  it("버릴 것이 없으면 아무 말도 하지 않는다", () => {
    const store = createEmptyStore(2026);
    store.checks = { "sports-day::quote": true };
    expect(pruneNotice(pruneStore(store, validTasks, validChecks))).toBeUndefined();
  });

  it("체크하지 않은 항목이 사라진 것은 알리지 않는다", () => {
    // 완료 표시를 잃은 것만 사용자에게 의미가 있다
    const store = createEmptyStore(2026);
    store.checks = { "gone::a": false };
    expect(pruneStore(store, validTasks, validChecks).droppedChecks).toBe(0);
  });
});
