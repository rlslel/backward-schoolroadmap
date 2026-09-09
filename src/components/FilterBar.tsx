import { ALL, describeFilter, isFiltering } from "../lib/filter";
import { CATEGORY_LABEL, type Category, type UiState } from "../types";
import { schoolYearMonths } from "../lib/dates";

const CATEGORIES: Category[] = ["legal", "annual", "grant", "custom"];

const CHIP: Record<Category, string> = {
  legal: "border-legal-line bg-legal text-legal-ink",
  annual: "border-annual-line bg-annual text-annual-ink",
  grant: "border-grant-line bg-grant text-grant-ink",
  custom: "border-custom-line bg-custom text-custom-ink",
};

interface Props {
  ui: UiState;
  depts: string[];
  count: number;
  onChange: (patch: Partial<UiState>) => void;
  onClear: () => void;
}

export default function FilterBar({ ui, depts, count, onChange, onClear }: Props) {
  const 걸림 = isFiltering(ui);

  return (
    <div className="card no-print mb-4 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <span className="text-xs font-medium text-ink-soft">분류</span>
        {CATEGORIES.map((c) => {
          const on = ui.category === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ category: on ? "all" : c })}
              aria-pressed={on}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                on ? CHIP[c] : "border-line text-ink-faint hover:bg-sunken"
              }`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          );
        })}

        <span className="mx-1 hidden h-4 w-px bg-line sm:block" />

        <select
          value={ui.dept}
          onChange={(e) => onChange({ dept: e.target.value })}
          aria-label="부서"
          className="rounded-md border border-line bg-card px-2 py-1 text-xs text-ink-soft"
        >
          <option value={ALL}>전 부서</option>
          {depts.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>

        <select
          value={String(ui.grade)}
          onChange={(e) => onChange({ grade: e.target.value === "all" ? "all" : Number(e.target.value) })}
          aria-label="학년"
          className="rounded-md border border-line bg-card px-2 py-1 text-xs text-ink-soft"
        >
          <option value="all">전 학년</option>
          {[1, 2, 3, 4, 5, 6].map((g) => (
            <option key={g} value={g}>
              {g}학년
            </option>
          ))}
        </select>

        <select
          value={String(ui.month)}
          onChange={(e) => onChange({ month: e.target.value === "all" ? "all" : Number(e.target.value) })}
          aria-label="월"
          className="rounded-md border border-line bg-card px-2 py-1 text-xs text-ink-soft"
        >
          <option value="all">전체 기간</option>
          {schoolYearMonths().map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </select>

        <span className="grow" />

        <span className="tnum text-xs text-ink-faint">{count}건</span>

        {걸림 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-line-strong px-2 py-1 text-xs text-ink-soft hover:bg-sunken"
          >
            필터 해제
          </button>
        )}
      </div>

      {걸림 && (
        <p className="mt-2 border-t border-line pt-2 text-xs text-ink-faint">
          {describeFilter(ui)} 로 걸러 보는 중입니다.
        </p>
      )}
    </div>
  );
}
