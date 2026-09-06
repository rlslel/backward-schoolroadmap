import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SHEET_CACHE_KEY,
  buildShareLink,
  effectiveAnchor,
  isAllowedSheetUrl,
  loadSheet,
  parseSheet,
  readSheetUrlFromHash,
  sheetIssueNotice,
  type FetchLike,
} from "./sheet";
import { dropEmptyRows, parseCsv } from "./csv";
import { parseFlexibleDate, toISO } from "./dates";
import { createMemoryStorage } from "./storage";
import type { Task } from "../types";

const IDS = new Set(["sports-day", "graduation", "art-festival"]);
const SHEET = "https://docs.google.com/spreadsheets/d/e/2PACX-1vAbc/pub?output=csv";

function okFetch(body: string): FetchLike {
  return vi.fn(async () => new Response(body, { status: 200 }));
}
const failFetch: FetchLike = vi.fn(async () => {
  throw new Error("네트워크 차단");
});

// ══════════════════════════════════════════════════════════
describe("CSV 읽기", () => {
  it("기본 표를 읽는다", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("윈도우 줄바꿈(CRLF)을 처리한다", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("엑셀이 붙이는 BOM 을 떼어 낸다", () => {
    expect(parseCsv("﻿업무ID,확정일\n")).toEqual([["업무ID", "확정일"]]);
  });

  it("따옴표 안의 쉼표와 줄바꿈을 칸 내용으로 본다", () => {
    expect(parseCsv('a,"쉼표, 포함",c')).toEqual([["a", "쉼표, 포함", "c"]]);
    expect(parseCsv('"두\n줄",b')).toEqual([["두\n줄", "b"]]);
  });

  it('따옴표 두 개("")는 따옴표 하나로 읽는다', () => {
    expect(parseCsv('"그는 ""안녕"" 이라 했다"')).toEqual([['그는 "안녕" 이라 했다']]);
  });

  it("빈 줄은 버린다", () => {
    expect(dropEmptyRows(parseCsv("a,b\n\n,\n1,2"))).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("빈 글자를 넣어도 예외를 던지지 않는다", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════
describe("날짜 인식 — 선생님이 어떻게 적든 읽어야 한다", () => {
  const 같음 = (text: string, iso: string) => {
    const d = parseFlexibleDate(text);
    expect(d, `「${text}」를 읽지 못했다`).not.toBeNull();
    expect(toISO(d!)).toBe(iso);
  };

  it("여러 형식을 받아들인다", () => {
    같음("2026-09-11", "2026-09-11");
    같음("2026-9-1", "2026-09-01");
    같음("2026. 9. 11.", "2026-09-11"); // 한국 구글 시트가 흔히 내보내는 형식
    같음("2026.9.11", "2026-09-11");
    같음("2026/9/11", "2026-09-11");
    같음("  2026-09-11  ", "2026-09-11");
  });

  it("읽을 수 없으면 null 을 준다", () => {
    for (const junk of ["", "미정", "9월 중", "2026-13-01", "2026-02-30", "내년 봄"]) {
      expect(parseFlexibleDate(junk), `「${junk}」`).toBeNull();
    }
  });
});

// ══════════════════════════════════════════════════════════
describe("시트 해석", () => {
  it("머리글이 있어도 없어도 읽는다", () => {
    const withHeader = parseSheet("업무ID,확정일\nsports-day,2026-09-11", IDS);
    const without = parseSheet("sports-day,2026-09-11", IDS);
    expect(withHeader.anchors).toEqual({ "sports-day": "2026-09-11" });
    expect(without.anchors).toEqual({ "sports-day": "2026-09-11" });
  });

  it("여러 줄을 읽는다", () => {
    const r = parseSheet("업무ID,확정일\nsports-day,2026-09-11\ngraduation,2027. 1. 9.", IDS);
    expect(r.anchors).toEqual({ "sports-day": "2026-09-11", graduation: "2027-01-09" });
    expect(r.totalRows).toBe(2);
  });

  it("한 줄에 오타가 있어도 나머지 줄은 정상 처리한다", () => {
    // 완료 기준 항목이다. 오타 하나로 전체가 죽으면 안 된다.
    const csv = ["업무ID,확정일", "sports-day,2026-09-11", "graduation,미정", "art-festival,2026-11-20"].join("\n");
    const r = parseSheet(csv, IDS);
    expect(Object.keys(r.anchors).sort()).toEqual(["art-festival", "sports-day"]);
    expect(r.invalidRows).toBe(1);
  });

  it("앱에 없는 업무 id 는 무시하되 개수를 알린다", () => {
    const r = parseSheet("업무ID,확정일\nsports-day,2026-09-11\n없는업무,2026-10-01", IDS);
    expect(r.anchors).toEqual({ "sports-day": "2026-09-11" });
    expect(r.unknownIds).toEqual(["없는업무"]);
  });

  it("셋째 칸에 메모를 적어 두어도 무시한다", () => {
    const r = parseSheet("업무ID,확정일,비고\nsports-day,2026-09-11,우천 시 순연", IDS);
    expect(r.anchors).toEqual({ "sports-day": "2026-09-11" });
  });

  it("같은 업무가 여러 줄이면 마지막 값을 쓴다", () => {
    const r = parseSheet("sports-day,2026-09-11\nsports-day,2026-09-18", IDS);
    expect(r.anchors["sports-day"]).toBe("2026-09-18");
  });

  it("빈 시트를 넣어도 예외를 던지지 않는다", () => {
    expect(parseSheet("", IDS).anchors).toEqual({});
    expect(parseSheet("업무ID,확정일\n", IDS).anchors).toEqual({});
  });

  it("문제가 있으면 한 줄로 알린다", () => {
    const r = parseSheet("sports-day,미정\n없는것,2026-01-01", IDS);
    expect(sheetIssueNotice(r)).toContain("건너뛰었습니다");
    expect(sheetIssueNotice(parseSheet("sports-day,2026-09-11", IDS))).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════
describe("주소 검사 — 아무 주소나 읽지 않는다", () => {
  it("구글 시트 주소만 허용한다", () => {
    expect(isAllowedSheetUrl(SHEET)).toBe(true);
    expect(isAllowedSheetUrl("https://docs.google.com/spreadsheets/d/x/edit")).toBe(true);
  });

  it("다른 곳으로는 요청하지 않는다", () => {
    for (const bad of [
      "https://evil.example.com/steal.csv",
      "http://docs.google.com/x", // https 가 아니다
      "https://docs.google.com.evil.com/x",
      "javascript:alert(1)",
      "그냥 글자",
      "",
    ]) {
      expect(isAllowedSheetUrl(bad), `「${bad}」를 허용하면 안 된다`).toBe(false);
    }
  });
});

describe("링크로 시트 주소 전달하기", () => {
  it("링크를 만들고 다시 읽어 낸다", () => {
    const link = buildShareLink("https://rlslel.github.io/backward-schoolroadmap/", SHEET);
    expect(link).toContain("#s=");
    expect(readSheetUrlFromHash(new URL(link).hash)).toBe(SHEET);
  });

  it("이미 해시가 붙은 주소로 다시 만들어도 겹치지 않는다", () => {
    const link = buildShareLink("https://example.com/app/#s=old", SHEET);
    expect(link.match(/#/g)?.length).toBe(1);
  });

  it("해시가 없으면 null", () => {
    expect(readSheetUrlFromHash("")).toBeNull();
    expect(readSheetUrlFromHash("#")).toBeNull();
    expect(readSheetUrlFromHash("#other=1")).toBeNull();
  });

  it("링크에 담긴 주소도 검사한다", () => {
    // 링크는 메신저로 돌아다닌다. 누가 바꿔 넣었을 수 있다.
    expect(readSheetUrlFromHash(`#s=${encodeURIComponent("https://evil.example.com/x")}`)).toBeNull();
  });

  it("깨진 인코딩에도 예외를 던지지 않는다", () => {
    expect(() => readSheetUrlFromHash("#s=%E0%A4%A")).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════
describe("시트 가져오기", () => {
  // 테스트마다 저장소를 새로 만든다. 같이 쓰면 앞 테스트가 남긴 캐시가 뒤 테스트에 새어 든다.
  let 기본: { validTaskIds: typeof IDS; storage: ReturnType<typeof createMemoryStorage> };
  beforeEach(() => {
    기본 = { validTaskIds: IDS, storage: createMemoryStorage() };
  });

  it("주소가 없으면 시드 기본값으로 간다", async () => {
    const r = await loadSheet({ ...기본, url: undefined, fetchImpl: failFetch });
    expect(r.status).toBe("none");
    expect(r.notice).toBeUndefined();
  });

  it("정상적으로 읽어 온다", async () => {
    const r = await loadSheet({
      ...기본,
      url: SHEET,
      fetchImpl: okFetch("업무ID,확정일\nsports-day,2026-09-11"),
    });
    expect(r.status).toBe("ok");
    expect(r.anchors).toEqual({ "sports-day": "2026-09-11" });
  });

  it("브라우저 캐시를 우회한다", async () => {
    // 부장이 시트를 고쳤는데 옛날 날짜가 보이면 이 앱은 신뢰를 잃는다
    const fetchImpl = okFetch("sports-day,2026-09-11");
    await loadSheet({ ...기본, url: SHEET, fetchImpl });
    const [calledUrl, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toContain("_=");
    expect(init.cache).toBe("no-store");
  });

  it("허용되지 않은 주소는 요청조차 하지 않는다", async () => {
    const fetchImpl = okFetch("x");
    const r = await loadSheet({ ...기본, url: "https://evil.example.com/x", fetchImpl });
    expect(r.status).toBe("blocked");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("못 읽어도 앱이 죽지 않고 기본값으로 간다", async () => {
    const r = await loadSheet({ ...기본, url: SHEET, fetchImpl: failFetch });
    expect(r.status).toBe("failed");
    expect(r.notice).toContain("기본 일정으로 표시");
    expect(r.anchors).toEqual({});
  });

  it("404 같은 응답도 실패로 처리한다", async () => {
    const notFound: FetchLike = async () => new Response("없음", { status: 404 });
    const r = await loadSheet({ ...기본, url: SHEET, fetchImpl: notFound });
    expect(r.status).toBe("failed");
  });

  it("한 번 성공하면 다음에 못 읽어도 지난 내용을 보여 준다", async () => {
    const storage = createMemoryStorage();
    await loadSheet({
      validTaskIds: IDS,
      storage,
      url: SHEET,
      fetchImpl: okFetch("sports-day,2026-09-11"),
      now: new Date(2026, 8, 6),
    });

    const r = await loadSheet({ validTaskIds: IDS, storage, url: SHEET, fetchImpl: failFetch });
    expect(r.status).toBe("cached");
    expect(r.anchors).toEqual({ "sports-day": "2026-09-11" });
    expect(r.notice).toContain("9월 6일");
  });

  it("시트 주소가 바뀌면 예전 캐시를 쓰지 않는다", async () => {
    const storage = createMemoryStorage();
    await loadSheet({ validTaskIds: IDS, storage, url: SHEET, fetchImpl: okFetch("sports-day,2026-09-11") });

    const other = "https://docs.google.com/spreadsheets/d/e/OTHER/pub?output=csv";
    const r = await loadSheet({ validTaskIds: IDS, storage, url: other, fetchImpl: failFetch });
    expect(r.status).toBe("failed");
  });

  it("저장이 막힌 브라우저에서도 읽기는 된다", async () => {
    const r = await loadSheet({
      validTaskIds: IDS,
      storage: null,
      url: SHEET,
      fetchImpl: okFetch("sports-day,2026-09-11"),
    });
    expect(r.status).toBe("ok");
    expect(r.anchors["sports-day"]).toBe("2026-09-11");
  });

  it("캐시에 쓰레기가 들어 있어도 버틴다", async () => {
    const storage = createMemoryStorage();
    storage.setItem(SHEET_CACHE_KEY, "이건 JSON 이 아니다");
    const r = await loadSheet({ validTaskIds: IDS, storage, url: SHEET, fetchImpl: failFetch });
    expect(r.status).toBe("failed");
  });
});

// ══════════════════════════════════════════════════════════
describe("시드 · 시트 · 사용자 수정 합치기", () => {
  const task = { id: "sports-day", anchor: { mode: "week", month: 9, week: 2 } } as Task;

  it("아무것도 없으면 시드 기본값", () => {
    const r = effectiveAnchor(task, undefined, {});
    expect(r.source).toBe("seed");
    expect(r.anchor).toEqual({ mode: "week", month: 9, week: 2 });
  });

  it("시트에 확정일이 있으면 시드를 덮어쓴다", () => {
    const r = effectiveAnchor(task, undefined, { "sports-day": "2026-09-11" });
    expect(r.source).toBe("sheet");
    expect(r.anchor).toEqual({ mode: "date", date: "2026-09-11" });
  });

  it("사용자가 직접 고친 값이 가장 앞선다", () => {
    const mine = { mode: "date", date: "2026-09-25" } as const;
    const r = effectiveAnchor(task, mine, { "sports-day": "2026-09-11" });
    expect(r.source).toBe("user");
    expect(r.anchor).toEqual(mine);
  });

  it("학교 일정과 달라졌으면 조용히 두지 않고 알려 준다", () => {
    const mine = { mode: "date", date: "2026-09-25" } as const;
    const r = effectiveAnchor(task, mine, { "sports-day": "2026-09-11" });
    expect(r.sheetAnchor).toEqual({ mode: "date", date: "2026-09-11" });
  });

  it("다른 업무의 시트 값에 영향받지 않는다", () => {
    const r = effectiveAnchor(task, undefined, { graduation: "2027-01-09" });
    expect(r.source).toBe("seed");
  });
});
