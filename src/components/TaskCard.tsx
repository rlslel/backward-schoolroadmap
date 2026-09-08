import type { ViewTask } from "../lib/view";
import { CATEGORY_LABEL, type Category } from "../types";
import SubtaskRow from "./SubtaskRow";

const BADGE: Record<Category, string> = {
  legal: "bg-legal text-legal-ink",
  annual: "bg-annual text-annual-ink",
  grant: "bg-grant text-grant-ink",
  custom: "bg-custom text-custom-ink",
};

const ANCHOR_SOURCE_LABEL = {
  sheet: "학교 확정일",
  user: "직접 입력",
  seed: "기본 제안일",
} as const;

interface Props {
  view: ViewTask;
  onToggle: (key: string, checked: boolean) => void;
}

export default function TaskCard({ view, onToggle }: Props) {
  const { task } = view;
  const 남은일 = view.subtasks.length - view.doneCount;

  return (
    <article className="rounded-lg border border-line bg-card">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-3 py-2.5">
        <h3 className="text-[15px] font-semibold text-ink">{task.title}</h3>

        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${BADGE[task.category]}`}>
          {CATEGORY_LABEL[task.category]}
        </span>
        <span className="text-xs text-ink-faint">{task.dept}</span>
        {task.grades && task.grades.length > 0 && (
          <span className="text-xs text-ink-faint">{task.grades.join("·")}학년</span>
        )}

        <span className="grow" />

        {view.lateCount > 0 && (
          <span className="tnum rounded bg-late px-1.5 py-0.5 text-[11px] font-medium text-late-ink">
            지연 {view.lateCount}
          </span>
        )}
        {view.soonCount > 0 && (
          <span className="tnum rounded bg-soon px-1.5 py-0.5 text-[11px] font-medium text-soon-ink">
            임박 {view.soonCount}
          </span>
        )}
        {view.missedCount > 0 && view.lateCount === 0 && view.soonCount === 0 && (
          <span className="tnum text-[11px] text-ink-faint">지난 일 {view.missedCount}</span>
        )}
        <span className="tnum text-xs text-ink-faint">
          {남은일 === 0 ? "모두 완료" : `${view.doneCount}/${view.subtasks.length}`}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-sunken/50 px-3 py-1.5 text-xs">
        <span className="text-ink-faint">행사일</span>
        <span className="tnum font-medium text-ink">{view.anchorText}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] ${
            view.anchorSource === "sheet" ? "bg-annual text-annual-ink" : "bg-sunken text-ink-soft"
          }`}
        >
          {ANCHOR_SOURCE_LABEL[view.anchorSource]}
        </span>

        {view.anchor.ignoredUserAnchor && (
          <span className="text-ink-faint">직접 입력한 날짜가 있으나 학교 확정일을 따릅니다</span>
        )}

        {task.basis && <span className="text-ink-faint">근거 · {task.basis}</span>}
        {view.needsBasis && (
          <span className="rounded bg-soon px-1.5 py-0.5 text-[11px] text-soon-ink">
            근거 확인 필요
          </span>
        )}
      </div>

      <ul className="space-y-px p-1.5">
        {view.subtasks.map((item) => (
          <SubtaskRow key={item.key} item={item} onToggle={onToggle} />
        ))}
      </ul>
    </article>
  );
}
