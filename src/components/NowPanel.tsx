import type { ViewSummary, ViewTask, ViewSubtask } from "../lib/view";

interface Props {
  summary: ViewSummary;
  urgent: { task: ViewTask; subtask: ViewSubtask }[];
  onToggle: (key: string, checked: boolean) => void;
}

/**
 * 화면을 열자마자 「지금 뭘 해야 하나」가 보이게 하는 부분.
 * 아래 타임라인은 1년 전체를 보여 주지만, 사람이 실제로 알고 싶은 것은 이 목록이다.
 */
export default function NowPanel({ summary, urgent, onToggle }: Props) {
  if (summary.total === 0) return null;

  if (urgent.length === 0) {
    return (
      <section className="rounded-lg border border-line bg-card px-4 py-3">
        <p className="text-sm text-ink-soft">
          지금 급한 일은 없습니다. 7일 안에 해야 할 항목이 생기면 여기에 먼저 표시됩니다.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-line bg-card">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold text-ink">지금 해야 할 일</h2>
        {summary.late > 0 && (
          <span className="tnum text-xs font-medium text-late-ink">기한 지남 {summary.late}건</span>
        )}
        {summary.soon > 0 && (
          <span className="tnum text-xs font-medium text-soon-ink">7일 안 {summary.soon}건</span>
        )}
        <span className="grow" />
        <span className="tnum text-xs text-ink-faint">
          전체 {summary.total}건 중 {summary.done}건 완료
        </span>
      </header>

      <ul className="divide-y divide-line">
        {urgent.slice(0, 8).map(({ task, subtask }) => (
          <li
            key={subtask.key}
            className={`flex items-start gap-2.5 px-4 py-2 ${
              subtask.status === "late" ? "bg-late/60" : "bg-soon/50"
            }`}
          >
            <input
              type="checkbox"
              checked={false}
              onChange={() => onToggle(subtask.key, true)}
              aria-label={`${subtask.subtask.title} 완료`}
              className="mt-1 size-4 shrink-0 cursor-pointer accent-ink"
            />
            <span className="tnum w-24 shrink-0 pt-px text-xs text-ink-soft">{subtask.dateText}</span>
            <span className="min-w-0 flex-1 text-sm">
              <span className="text-ink">{subtask.subtask.title}</span>
              <span className="ml-2 text-xs text-ink-faint">{task.task.title}</span>
            </span>
            <span
              className={`tnum shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                subtask.status === "late"
                  ? "bg-late-line/60 text-late-ink"
                  : "bg-soon-line/60 text-soon-ink"
              }`}
            >
              {subtask.status === "late"
                ? `${-subtask.days}일 지남`
                : subtask.days === 0
                  ? "오늘"
                  : `${subtask.days}일 뒤`}
            </span>
          </li>
        ))}
      </ul>

      {urgent.length > 8 && (
        <p className="border-t border-line px-4 py-2 text-xs text-ink-faint">
          아래 목록에 {urgent.length - 8}건이 더 있습니다.
        </p>
      )}
    </section>
  );
}
