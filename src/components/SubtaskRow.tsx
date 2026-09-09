import { useState } from "react";
import type { ViewSubtask } from "../lib/view";

const STATUS_STYLE: Record<ViewSubtask["status"], string> = {
  late: "bg-late",
  soon: "bg-soon",
  missed: "",
  done: "",
  upcoming: "",
};

function StatusTag({ item }: { item: ViewSubtask }) {
  if (item.status === "late") {
    return (
      <span className="tnum shrink-0 rounded bg-late-line/60 px-1.5 py-0.5 text-[11px] font-medium text-late-ink">
        {-item.days}일 지남
      </span>
    );
  }
  if (item.status === "soon") {
    return (
      <span className="tnum shrink-0 rounded bg-soon-line/60 px-1.5 py-0.5 text-[11px] font-medium text-soon-ink">
        {item.days === 0 ? "오늘" : `${item.days}일 뒤`}
      </span>
    );
  }
  if (item.status === "missed") {
    return <span className="shrink-0 text-[11px] text-ink-faint">지난 일</span>;
  }
  return null;
}

interface Props {
  item: ViewSubtask;
  onToggle: (key: string, checked: boolean) => void;
  /** 준비 기간 조정 중인가. 켜면 D-day 자리가 입력칸으로 바뀐다. */
  editing?: boolean;
  onOffsetChange?: (offsetDays: number) => void;
}

export default function SubtaskRow({ item, onToggle, editing, onOffsetChange }: Props) {
  const [open, setOpen] = useState(false);
  const { subtask } = item;
  const hasDetail = Boolean(item.draftTitle || subtask.attachments?.length || subtask.caution);
  const done = item.status === "done";
  const dim = done || item.status === "missed";

  return (
    <li className={`rounded-md ${STATUS_STYLE[item.status]}`}>
      <div className="flex items-start gap-2.5 px-2 py-1.5">
        <input
          type="checkbox"
          checked={done}
          onChange={(e) => onToggle(item.key, e.target.checked)}
          aria-label={`${subtask.title} 완료`}
          className="mt-1 size-4 shrink-0 cursor-pointer accent-ink"
        />

        {editing && onOffsetChange ? (
          <input
            type="number"
            value={item.offset}
            onChange={(e) => onOffsetChange(Number(e.target.value))}
            aria-label={`${subtask.title} 날짜 간격`}
            className="tnum w-14 shrink-0 rounded border border-line-strong bg-card px-1 py-0.5 text-xs text-ink"
          />
        ) : (
          <span
            className={`tnum w-14 shrink-0 pt-0.5 text-xs font-medium ${
              item.customized ? "text-annual-ink" : dim ? "text-ink-faint" : "text-ink-soft"
            }`}
          >
            {item.dLabel}
          </span>
        )}

        <span className={`tnum w-20 shrink-0 pt-0.5 text-xs sm:w-24 ${dim ? "text-ink-faint" : "text-ink-soft"}`}>
          {item.dateText}
        </span>

        <span className={`min-w-0 flex-1 text-sm ${
            done ? "text-ink-faint line-through" : dim ? "text-ink-faint" : "text-ink"
          }`}>
          {subtask.title}
          {item.customized && (
            <span className="ml-1.5 align-middle text-[11px] text-ink-faint">· 직접 조정함</span>
          )}
          {item.shifted && <span className="ml-1.5 align-middle text-[11px] text-ink-faint">· 주말 보정</span>}
        </span>

        <StatusTag item={item} />

        {hasDetail && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-ink-faint hover:bg-sunken hover:text-ink-soft"
          >
            {open ? "접기" : "방법"}
          </button>
        )}
      </div>

      {open && hasDetail && <Detail item={item} />}
    </li>
  );
}

function Detail({ item }: { item: ViewSubtask }) {
  const { subtask } = item;
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false); // 복사가 막힌 브라우저에서는 조용히 넘어간다
    }
  };

  return (
    <div className="mb-1.5 ml-8 space-y-1.5 border-l-2 border-line pl-3 text-xs text-ink-soft sm:ml-[4.6rem]">
      {item.draftTitle && (
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="text-ink-faint">기안 제목</span>
          <span className="text-ink">「{item.draftTitle}」</span>
          <button
            type="button"
            onClick={() => copy(item.draftTitle!)}
            className="rounded border border-line-strong px-1.5 py-px text-[11px] text-ink-soft hover:bg-sunken"
          >
            {copied ? "복사됨" : "복사"}
          </button>
        </p>
      )}

      {subtask.attachments && subtask.attachments.length > 0 && (
        <p>
          <span className="text-ink-faint">붙임 </span>
          {subtask.attachments.join(" · ")}
        </p>
      )}

      {subtask.caution && (
        <p className="text-soon-ink">
          <span className="text-ink-faint">자주 틀리는 점 </span>
          {subtask.caution}
        </p>
      )}
    </div>
  );
}
