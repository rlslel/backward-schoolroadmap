import type { AgendaEntry, PendingDecision } from "../lib/agenda";
import type { ViewSubtask, ViewTask } from "../lib/view";
import type { MeetingBody } from "../types";

function Panel({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // 네 칸의 높이를 맞춰야 한눈에 들어온다. 넘치는 내용은 칸 안에서 스크롤한다.
    <section className="flex h-72 flex-col rounded-lg border border-line bg-card">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {count && <span className="tnum text-xs text-ink-faint">{count}</span>}
        <span className="grow" />
        {action}
      </header>
      <div className="min-h-0 grow overflow-y-auto p-2">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-1 py-4 text-center text-xs text-ink-faint">{text}</p>;
}

function DayTag({ item }: { item: ViewSubtask }) {
  if (item.status === "late") {
    return (
      <span className="tnum shrink-0 rounded bg-late-line/60 px-1.5 py-0.5 text-[11px] font-medium text-late-ink">
        {-item.days}일 지남
      </span>
    );
  }
  return (
    <span
      className={`tnum shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
        item.status === "soon" ? "bg-soon-line/60 font-medium text-soon-ink" : "text-ink-faint"
      }`}
    >
      {item.days === 0 ? "오늘" : `${item.days}일 뒤`}
    </span>
  );
}

interface Props {
  meeting: MeetingBody;
  meetings: MeetingBody[];
  onMeetingChange: (id: string) => void;
  agenda: AgendaEntry[];
  academic: ViewTask[];
  todo: { task: ViewTask; subtask: ViewSubtask }[];
  pending: PendingDecision[];
  onToggle: (key: string, checked: boolean) => void;
  onOpenAgenda: () => void;
  onOpenSchedule: () => void;
}

export default function Dashboard({
  meeting,
  meetings,
  onMeetingChange,
  agenda,
  academic,
  todo,
  pending,
  onToggle,
  onOpenAgenda,
  onOpenSchedule,
}: Props) {
  const 안건수 = agenda.reduce((n, e) => n + e.items.length, 0);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* ① 부서 회의 안건 */}
      <Panel
        title={`${meeting.name} 회의 안건`}
        count={안건수 > 0 ? `${안건수}건` : undefined}
        action={
          <>
            <select
              value={meeting.id}
              onChange={(e) => onMeetingChange(e.target.value)}
              aria-label="회의 선택"
              className="max-w-32 rounded border border-line-strong bg-card px-1.5 py-0.5 text-xs text-ink-soft"
            >
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onOpenAgenda}
              className="rounded border border-line-strong px-1.5 py-0.5 text-xs text-ink-soft hover:bg-sunken"
            >
              인쇄
            </button>
          </>
        }
      >
        {agenda.length === 0 ? (
          <Empty text="이번 달 이 회의에서 다룰 안건이 없습니다." />
        ) : (
          <ul className="space-y-2">
            {agenda.slice(0, 6).map((entry) => (
              <li key={entry.task.task.id}>
                <p className="px-1 text-xs font-medium text-ink">{entry.task.task.title}</p>
                <ul className="mt-0.5">
                  {entry.items.map((item) => (
                    <li key={item.key} className="flex items-center gap-2 px-1 py-0.5 text-xs">
                      <span className="tnum w-20 shrink-0 text-ink-faint">{item.dateText}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-soft">{item.subtask.title}</span>
                      <DayTag item={item} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ② 통상학사 — 1달 내 */}
      <Panel
        title="통상학사"
        count="앞으로 한 달"
        action={
          <button
            type="button"
            onClick={onOpenSchedule}
            className="rounded border border-line-strong px-1.5 py-0.5 text-xs text-ink-soft hover:bg-sunken"
          >
            전체 보기
          </button>
        }
      >
        {academic.length === 0 ? (
          <Empty text="한 달 안에 예정된 학사 행사가 없습니다." />
        ) : (
          <ul className="divide-y divide-line">
            {academic.map((v) => (
              <li key={v.task.id} className="flex items-center gap-2 px-1 py-1.5 text-xs">
                <span className="tnum w-20 shrink-0 text-ink-soft">{v.anchorText}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{v.task.title}</span>
                <span className="shrink-0 text-ink-faint">{v.task.dept}</span>
                {v.lateCount + v.soonCount > 0 && (
                  <span className="tnum shrink-0 rounded bg-soon px-1.5 py-0.5 text-[11px] text-soon-ink">
                    준비 {v.lateCount + v.soonCount}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ③ To do list */}
      <Panel title="To do list" count={todo.length > 0 ? `${todo.length}건` : undefined}>
        {todo.length === 0 ? (
          <Empty text="지금 급한 일이 없습니다." />
        ) : (
          <ul className="divide-y divide-line">
            {todo.slice(0, 10).map(({ task, subtask }) => (
              <li key={subtask.key} className="flex items-start gap-2 px-1 py-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => onToggle(subtask.key, true)}
                  aria-label={`${subtask.subtask.title} 완료`}
                  className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-ink"
                />
                <span className="tnum w-20 shrink-0 text-ink-faint">{subtask.dateText}</span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink">{subtask.subtask.title}</span>
                  <span className="ml-1.5 text-ink-faint">{task.task.title}</span>
                </span>
                <DayTag item={subtask} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ④ 정해야 할 것 */}
      <Panel title="정해야 할 것" count={pending.length > 0 ? `${pending.length}건` : undefined}>
        {pending.length === 0 ? (
          <Empty text="확정하지 않은 항목이 없습니다." />
        ) : (
          <ul className="divide-y divide-line">
            {pending.slice(0, 10).map((p) => (
              <li key={p.view.task.id} className="flex items-center gap-2 px-1 py-1.5 text-xs">
                <span className="tnum w-20 shrink-0 text-ink-faint">{p.view.anchorText}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{p.view.task.title}</span>
                <span className="shrink-0 text-ink-faint">{p.view.task.dept}</span>
                {p.reasons.map((reason) => (
                  <span
                    key={reason}
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
                      reason === "날짜 미확정" ? "bg-annual text-annual-ink" : "bg-soon text-soon-ink"
                    }`}
                  >
                    {reason}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
