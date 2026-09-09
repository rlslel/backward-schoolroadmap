import { useState } from "react";
import type { ViewTask } from "../lib/view";
import { CATEGORY_LABEL, type Category } from "../types";
import SubtaskRow from "./SubtaskRow";

/** 분류마다 다른 파스텔 톤을 준다. 카드가 여러 개 늘어서도 한눈에 구분된다. */
const TINT: Record<Category, { head: string; badge: string }> = {
  legal: { head: "bg-legal border-legal-line", badge: "bg-legal-line/50 text-legal-ink" },
  annual: { head: "bg-annual border-annual-line", badge: "bg-annual-line/50 text-annual-ink" },
  grant: { head: "bg-grant border-grant-line", badge: "bg-grant-line/50 text-grant-ink" },
  custom: { head: "bg-custom border-custom-line", badge: "bg-custom-line/50 text-custom-ink" },
};

const ANCHOR_SOURCE_LABEL = {
  sheet: "학교 확정일",
  user: "직접 입력",
  seed: "기본 제안일",
} as const;

interface Props {
  view: ViewTask;
  onToggle: (key: string, checked: boolean) => void;
  onDisable?: (taskId: string) => void;
  onAnchorChange?: (taskId: string, date: string) => void;
  onOffsetChange?: (taskId: string, subtaskId: string, offsetDays: number) => void;
  onResetOffsets?: (taskId: string) => void;
}

export default function TaskCard({
  view,
  onToggle,
  onDisable,
  onAnchorChange,
  onOffsetChange,
  onResetOffsets,
}: Props) {
  const [editing, setEditing] = useState(false);
  const { task } = view;
  const tint = TINT[task.category];
  const 남은일 = view.subtasks.length - view.doneCount;
  const 시트관리 = view.anchorSource === "sheet";
  const 조정한항목 = view.subtasks.filter((s) => s.customized).length;

  return (
    <article className="card card-hover overflow-hidden">
      <header className={`flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-3 py-2.5 ${tint.head}`}>
        <h3 className="text-[15px] font-semibold text-ink">{task.title}</h3>

        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tint.badge}`}>
          {CATEGORY_LABEL[task.category]}
        </span>
        <span className="text-xs text-ink-soft">{task.dept}</span>
        {task.grades && task.grades.length > 0 && (
          <span className="text-xs text-ink-soft">{task.grades.join("·")}학년</span>
        )}

        <span className="grow" />

        {view.lateCount > 0 && (
          <span className="tnum rounded-full bg-late px-2 py-0.5 text-[11px] font-medium text-late-ink">
            지연 {view.lateCount}
          </span>
        )}
        {view.soonCount > 0 && (
          <span className="tnum rounded-full bg-soon px-2 py-0.5 text-[11px] font-medium text-soon-ink">
            임박 {view.soonCount}
          </span>
        )}
        {view.missedCount > 0 && view.lateCount === 0 && view.soonCount === 0 && (
          <span className="tnum text-[11px] text-ink-faint">지난 일 {view.missedCount}</span>
        )}
        <span className="tnum text-xs text-ink-soft">
          {남은일 === 0 ? "모두 완료" : `${view.doneCount}/${view.subtasks.length}`}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-sunken/40 px-3 py-2 text-xs">
        <span className="text-ink-faint">행사일</span>

        {시트관리 || !onAnchorChange ? (
          <span className="tnum font-medium text-ink">{view.anchorText}</span>
        ) : (
          <input
            type="date"
            value={view.anchorISO}
            onChange={(e) => e.target.value && onAnchorChange(task.id, e.target.value)}
            aria-label={`${task.title} 행사일`}
            className="tnum rounded border border-line-strong bg-card px-1.5 py-0.5 text-xs text-ink"
          />
        )}

        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            시트관리 ? "bg-annual text-annual-ink" : "bg-sunken text-ink-soft"
          }`}
        >
          {ANCHOR_SOURCE_LABEL[view.anchorSource]}
        </span>

        {시트관리 && <span className="text-ink-faint">시트에서 관리합니다</span>}
        {view.anchor.ignoredUserAnchor && (
          <span className="text-ink-faint">직접 넣은 날짜가 있으나 학교 확정일을 따릅니다</span>
        )}

        {task.basis && <span className="text-ink-faint">근거 · {task.basis}</span>}
        {view.needsBasis && (
          <span className="rounded-full bg-soon px-2 py-0.5 text-[11px] text-soon-ink">근거 확인 필요</span>
        )}

        <span className="grow" />

        {onOffsetChange && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="no-print rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-faint hover:bg-sunken hover:text-ink-soft"
          >
            {editing ? "조정 마침" : "준비 기간 조정"}
          </button>
        )}
        {onDisable && (
          <button
            type="button"
            onClick={() => onDisable(task.id)}
            title="우리 학교가 하지 않는 업무로 표시합니다"
            className="no-print rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-faint hover:bg-sunken hover:text-ink-soft"
          >
            끄기
          </button>
        )}
      </div>

      {editing && (
        <p className="border-b border-line bg-soon/50 px-3 py-1.5 text-[11px] text-soon-ink">
          아래 숫자는 규정이 아니라 제안값입니다. 학교 사정에 맞게 고치세요. 고친 값은 이 브라우저에만
          저장됩니다.
          {조정한항목 > 0 && onResetOffsets && (
            <button
              type="button"
              onClick={() => onResetOffsets(task.id)}
              className="ml-2 rounded border border-soon-line px-1.5 py-0.5 hover:bg-soon"
            >
              제안값으로 되돌리기 ({조정한항목})
            </button>
          )}
        </p>
      )}

      <ul className="notepad ruled px-1.5">
        {view.subtasks.map((item) => (
          <SubtaskRow
            key={item.key}
            item={item}
            onToggle={onToggle}
            editing={editing}
            onOffsetChange={onOffsetChange ? (n) => onOffsetChange(task.id, item.subtask.id, n) : undefined}
          />
        ))}
      </ul>
    </article>
  );
}
