import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SEED_TASKS } from "./data/tasks.seed";
import { buildTaskLookup, loadSheet, pickSheetUrl, sheetIssueNotice, type SheetLoadResult } from "./lib/sheet";
import {
  clearStore,
  createEmptyStore,
  detectStorage,
  loadStore,
  saveStore,
  type StorageLike,
} from "./lib/storage";
import { buildTasks, groupByMonth, summarize, urgentItems } from "./lib/view";
import type { Store } from "./types";
import NowPanel from "./components/NowPanel";
import TaskCard from "./components/TaskCard";

const SCHOOL_YEAR = 2026;
const LOOKUP = buildTaskLookup(SEED_TASKS);

export default function App() {
  const storage = useRef<StorageLike | null>(null);
  if (storage.current === null) storage.current = detectStorage();

  const [store, setStore] = useState<Store>(() => createEmptyStore(SCHOOL_YEAR));
  const [notices, setNotices] = useState<string[]>([]);
  const [sheet, setSheet] = useState<SheetLoadResult | null>(null);
  const [loading, setLoading] = useState(true);

  // 처음 열 때: 저장된 내용을 읽고, 링크에 실려 온 시트 주소를 확인한다
  useEffect(() => {
    const loaded = loadStore(storage.current, SCHOOL_YEAR);
    const url = pickSheetUrl(window.location.hash, loaded.store.sheetUrl);
    const next = url && url !== loaded.store.sheetUrl ? { ...loaded.store, sheetUrl: url } : loaded.store;

    setStore(next);
    if (loaded.notice) setNotices((n) => [...n, loaded.notice!]);

    let cancelled = false;
    void loadSheet({
      url,
      validTaskIds: LOOKUP,
      fetchImpl: (u, init) => fetch(u, init),
      storage: storage.current,
    }).then((result) => {
      if (cancelled) return;
      setSheet(result);
      setLoading(false);
      const messages = [result.notice, sheetIssueNotice(result)].filter(Boolean) as string[];
      if (messages.length > 0) setNotices((n) => [...n, ...messages]);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // 바뀔 때마다 저장한다. 저장이 막힌 브라우저에서는 조용히 넘어간다.
  useEffect(() => {
    if (loading) return;
    saveStore(storage.current, store);
  }, [store, loading]);

  const toggleCheck = useCallback((key: string, checked: boolean) => {
    setStore((prev) => {
      const checks = { ...prev.checks };
      if (checked) checks[key] = true;
      else delete checks[key];
      return { ...prev, checks };
    });
  }, []);

  const deleteAll = useCallback(() => {
    if (!window.confirm("이 브라우저에 저장된 완료 표시와 설정을 모두 지웁니다. 계속할까요?")) return;
    clearStore(storage.current);
    setStore(createEmptyStore(SCHOOL_YEAR));
    setNotices(["저장된 내용을 모두 지웠습니다."]);
  }, []);

  // 캐시하지 않는다. 앵커가 바뀌면 즉시 전부 다시 계산되어야 한다.
  const views = useMemo(
    () => buildTasks({ tasks: SEED_TASKS, store, sheetAnchors: sheet?.anchors ?? {}, today: new Date() }),
    [store, sheet],
  );
  const months = useMemo(() => groupByMonth(views), [views]);
  const summary = useMemo(() => summarize(views), [views]);
  const urgent = useMemo(() => urgentItems(views), [views]);

  return (
    <div className="min-h-screen bg-page">
      <TopBar sheet={sheet} loading={loading} onDeleteAll={deleteAll} />

      <main className="mx-auto max-w-4xl px-4 pb-16">
        {notices.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {notices.map((text, i) => (
              <p
                key={i}
                className="rounded-md border border-soon-line bg-soon px-3 py-2 text-xs text-soon-ink"
              >
                {text}
              </p>
            ))}
          </div>
        )}

        <div className="mt-3">
          <NowPanel summary={summary} urgent={urgent} onToggle={toggleCheck} />
        </div>

        <div className="mt-5 space-y-5">
          {months.map((month) => (
            <section key={month.month}>
              <h2 className="sticky top-0 z-10 -mx-1 bg-page/95 px-1 py-2 text-sm font-semibold text-ink-soft backdrop-blur">
                {month.label}
                <span className="tnum ml-2 font-normal text-ink-faint">{month.tasks.length}건</span>
              </h2>

              {month.tasks.length === 0 ? (
                <p className="px-1 pb-1 text-xs text-ink-faint">등록된 업무가 없습니다.</p>
              ) : (
                <div className="space-y-2.5">
                  {month.tasks.map((view) => (
                    <TaskCard key={view.task.id} view={view} onToggle={toggleCheck} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        <p className="mt-10 border-t border-line pt-4 text-center text-xs text-ink-faint">
          본 일정은 참고용 표준안이며, 최종 시행일은 소속 학교·교육청 지침을 따릅니다.
        </p>
      </main>
    </div>
  );
}

function TopBar({
  sheet,
  loading,
  onDeleteAll,
}: {
  sheet: SheetLoadResult | null;
  loading: boolean;
  onDeleteAll: () => void;
}) {
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <h1 className="text-base font-semibold text-ink">학교업무 역산 로드맵</h1>
        <span className="tnum rounded bg-sunken px-1.5 py-0.5 text-xs text-ink-soft">
          {SCHOOL_YEAR}학년도
        </span>

        <span className="grow" />

        <SheetBadge sheet={sheet} loading={loading} />

        <button
          type="button"
          onClick={onDeleteAll}
          className="rounded border border-line-strong px-2 py-1 text-xs text-ink-soft hover:bg-sunken"
        >
          내 데이터 전체 삭제
        </button>
      </div>

      <div className="border-t border-line bg-sunken/60">
        <p className="mx-auto max-w-4xl px-4 py-1.5 text-[11px] text-ink-soft">
          완료 표시와 설정은 이 브라우저에만 저장되며 외부로 전송되지 않습니다. 학교 일정 시트는
          읽기만 합니다.
        </p>
      </div>
    </header>
  );
}

function SheetBadge({ sheet, loading }: { sheet: SheetLoadResult | null; loading: boolean }) {
  if (loading) return <span className="text-xs text-ink-faint">학교 일정 확인 중…</span>;
  if (!sheet || sheet.status === "none") {
    return <span className="text-xs text-ink-faint">기본 일정</span>;
  }
  if (sheet.status === "ok") {
    return (
      <span className="tnum rounded bg-annual px-1.5 py-0.5 text-xs text-annual-ink">
        학교 일정 {Object.keys(sheet.anchors).length}건 반영
      </span>
    );
  }
  return <span className="rounded bg-soon px-1.5 py-0.5 text-xs text-soon-ink">기본 일정으로 표시 중</span>;
}
