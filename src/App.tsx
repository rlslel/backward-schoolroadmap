import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEPTS, SEED_TASKS } from "./data/tasks.seed";
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
import { meetingAgenda, pendingDecisions, schoolDepts, upcomingAcademic } from "./lib/agenda";
import {
  addMeeting,
  allMeetings,
  buildMeeting,
  describeScope,
  filterByMeeting,
  findMeeting,
  removeMeeting,
  type MeetingInput,
} from "./lib/meeting";
import type { Store } from "./types";
import {
  addCustomTask,
  buildCustomTask,
  disabledSeedTasks,
  offByDefaultTasks,
  removeCustomTask,
  setEnabled,
  type CustomTaskInput,
} from "./lib/customTask";
import AgendaSheet from "./components/AgendaSheet";
import Dashboard from "./components/Dashboard";
import SchoolSetup from "./components/SchoolSetup";
import TaskCard from "./components/TaskCard";

const SCHOOL_YEAR = 2026;
const LOOKUP = buildTaskLookup(SEED_TASKS);

type Tab = "home" | "schedule" | "agenda" | "setup";

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "홈" },
  { id: "schedule", label: "학사 일정" },
  { id: "agenda", label: "회의 안건" },
  { id: "setup", label: "우리 학교" },
];

export default function App() {
  const storage = useRef<StorageLike | null>(null);
  if (storage.current === null) storage.current = detectStorage();

  const [store, setStore] = useState<Store>(() => createEmptyStore(SCHOOL_YEAR));
  const [notices, setNotices] = useState<string[]>([]);
  const [sheet, setSheet] = useState<SheetLoadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("home");

  const today = useMemo(() => new Date(), []);

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

  const setMeeting = useCallback((meetingId: string) => {
    setStore((prev) => ({ ...prev, ui: { ...prev.ui, meetingId } }));
  }, []);

  const addMeetingBody = useCallback((input: MeetingInput) => {
    setStore((prev) => {
      const used = new Set(prev.meetings.map((m) => m.id));
      return addMeeting(prev, buildMeeting(input, used));
    });
  }, []);

  const removeMeetingBody = useCallback((meetingId: string) => {
    setStore((prev) => removeMeeting(prev, meetingId));
  }, []);

  const disableTask = useCallback((taskId: string) => {
    setStore((prev) => setEnabled(prev, taskId, false));
  }, []);

  const enableTask = useCallback((taskId: string, enabled: boolean) => {
    setStore((prev) => setEnabled(prev, taskId, enabled));
  }, []);

  const addTask = useCallback((input: CustomTaskInput) => {
    setStore((prev) => {
      const used = new Set([...SEED_TASKS.map((t) => t.id), ...prev.customTasks.map((t) => t.id)]);
      return addCustomTask(prev, buildCustomTask(input, used));
    });
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setStore((prev) => removeCustomTask(prev, taskId));
  }, []);

  const deleteAll = useCallback(() => {
    if (!window.confirm("이 브라우저에 저장된 완료 표시와 설정을 모두 지웁니다. 계속할까요?")) return;
    clearStore(storage.current);
    setStore(createEmptyStore(SCHOOL_YEAR));
    setNotices(["저장된 내용을 모두 지웠습니다."]);
  }, []);

  // 캐시하지 않는다. 앵커가 바뀌면 즉시 전부 다시 계산되어야 한다.
  const views = useMemo(
    () => buildTasks({ tasks: SEED_TASKS, store, sheetAnchors: sheet?.anchors ?? {}, today }),
    [store, sheet, today],
  );

  const depts = useMemo(() => schoolDepts(DEPTS, store.customTasks), [store.customTasks]);
  const meetings = useMemo(() => allMeetings(store, depts), [store, depts]);
  const meeting = useMemo(
    () => findMeeting(store, depts, store.ui.meetingId),
    [store, depts],
  );

  const months = useMemo(() => groupByMonth(views), [views]);
  const summary = useMemo(() => summarize(views), [views]);
  const todo = useMemo(() => urgentItems(views), [views]);
  const agenda = useMemo(() => meetingAgenda(views, meeting), [views, meeting]);
  const academic = useMemo(() => upcomingAcademic(views, today), [views, today]);
  const pendingAll = useMemo(() => pendingDecisions(views, today), [views, today]);
  const pendingDept = useMemo(() => {
    const 대상 = new Set(filterByMeeting(views, meeting).map((v) => v.task.id));
    return pendingAll.filter((p) => 대상.has(p.view.task.id));
  }, [pendingAll, views, meeting]);

  return (
    <div className="min-h-screen bg-page">
      <header className="no-print border-b border-line bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <h1 className="text-base font-semibold text-ink">학교업무 역산 로드맵</h1>
          <span className="tnum rounded bg-sunken px-1.5 py-0.5 text-xs text-ink-soft">
            {SCHOOL_YEAR}학년도
          </span>

          <span className="grow" />

          <SheetBadge sheet={sheet} loading={loading} />
          <SummaryBadges summary={summary} />

          <button
            type="button"
            onClick={deleteAll}
            className="rounded border border-line-strong px-2 py-1 text-xs text-ink-soft hover:bg-sunken"
          >
            내 데이터 전체 삭제
          </button>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                tab === t.id
                  ? "border-ink font-medium text-ink"
                  : "border-transparent text-ink-faint hover:text-ink-soft"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-line bg-sunken/60">
          <p className="mx-auto max-w-5xl px-4 py-1.5 text-[11px] text-ink-soft">
            완료 표시와 설정은 이 브라우저에만 저장되며 외부로 전송되지 않습니다. 학교 일정 시트는
            읽기만 합니다.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        {notices.length > 0 && (
          <div className="no-print mt-3 space-y-1.5">
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

        {tab === "home" && (
          <div className="mt-3">
            <Dashboard
              meeting={meeting}
              meetings={meetings}
              onMeetingChange={setMeeting}
              agenda={agenda}
              academic={academic}
              todo={todo}
              pending={pendingDept}
              onToggle={toggleCheck}
              onOpenAgenda={() => setTab("agenda")}
              onOpenSchedule={() => setTab("schedule")}
            />
          </div>
        )}

        {tab === "schedule" && (
          <div className="mt-4 space-y-5">
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
                      <TaskCard
                        key={view.task.id}
                        view={view}
                        onToggle={toggleCheck}
                        onDisable={disableTask}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        {tab === "agenda" && (
          <div className="mt-4">
            <div className="no-print mb-3 flex flex-wrap items-center gap-2">
              <label className="text-xs text-ink-soft">회의</label>
              <select
                value={meeting.id}
                onChange={(e) => setMeeting(e.target.value)}
                className="rounded border border-line-strong bg-card px-2 py-1 text-xs text-ink"
              >
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-ink-faint">{describeScope(meeting)}</span>
              <span className="grow" />
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded border border-line-strong bg-card px-3 py-1 text-xs font-medium text-ink hover:bg-sunken"
              >
                인쇄
              </button>
            </div>

            <AgendaSheet
              schoolYear={SCHOOL_YEAR}
              today={today}
              meetingName={meeting.name}
              scope={describeScope(meeting)}
              agenda={agenda}
              pending={pendingDept}
            />
          </div>
        )}

        {tab === "setup" && (
          <div className="mt-4">
            <SchoolSetup
              depts={depts}
              meetings={store.meetings}
              allMeetingNames={meetings}
              onAddMeeting={addMeetingBody}
              onRemoveMeeting={removeMeetingBody}
              sheetUrl={store.sheetUrl}
              customTasks={store.customTasks}
              disabledTasks={disabledSeedTasks(store, SEED_TASKS)}
              offByDefault={offByDefaultTasks(store, SEED_TASKS)}
              onAdd={addTask}
              onRemove={removeTask}
              onEnable={enableTask}
            />
          </div>
        )}

        {tab !== "agenda" && (
          <p className="no-print mt-10 border-t border-line pt-4 text-center text-xs text-ink-faint">
            본 일정은 참고용 표준안이며, 최종 시행일은 소속 학교·교육청 지침을 따릅니다.
          </p>
        )}
      </main>
    </div>
  );
}

function SummaryBadges({ summary }: { summary: ReturnType<typeof summarize> }) {
  if (summary.late === 0 && summary.soon === 0) return null;
  return (
    <span className="flex items-center gap-1.5">
      {summary.late > 0 && (
        <span className="tnum rounded bg-late px-1.5 py-0.5 text-xs font-medium text-late-ink">
          지연 {summary.late}
        </span>
      )}
      {summary.soon > 0 && (
        <span className="tnum rounded bg-soon px-1.5 py-0.5 text-xs font-medium text-soon-ink">
          임박 {summary.soon}
        </span>
      )}
    </span>
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
