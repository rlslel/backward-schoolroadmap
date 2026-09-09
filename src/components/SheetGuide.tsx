import { useState } from "react";
import { OFF_LABELS } from "../lib/sheet";
import type { Task } from "../types";

/**
 * 시트에 무엇을 적을 수 있는지 보여 준다.
 *
 * 시트를 채우는 사람은 앱을 안 보고 시트만 본다. 무엇을 적을 수 있는지 모르면
 * 「봄 운동회」를 적어 놓고 왜 안 나오는지 몰라 헤맨다. 선택지를 눈으로 보여 준다.
 */
interface Props {
  depts: string[];
  seedTasks: Task[];
}

function Chip({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "off" | "new" }) {
  const style =
    tone === "off"
      ? "border-late-line bg-late text-late-ink"
      : tone === "new"
        ? "border-custom-line bg-custom text-custom-ink"
        : "border-line-strong bg-card text-ink-soft";
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] ${style}`}>{children}</span>;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded border border-line-strong px-2 py-0.5 text-[11px] text-ink-soft hover:bg-sunken"
    >
      {copied ? "복사됨" : label}
    </button>
  );
}

export default function SheetGuide({ depts, seedTasks }: Props) {
  const [openNames, setOpenNames] = useState(false);

  return (
    <div className="space-y-4">
      {/* 시트 모양 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-md border-collapse text-xs">
          <thead>
            <tr className="border-y border-line-strong bg-sunken text-ink-soft">
              <th className="px-2 py-1.5 text-left font-medium">A · 업무</th>
              <th className="px-2 py-1.5 text-left font-medium">B · 확정일</th>
              <th className="px-2 py-1.5 text-left font-medium">C · 부서 (선택)</th>
            </tr>
          </thead>
          <tbody className="tnum">
            <tr className="border-b border-line">
              <td className="px-2 py-1.5 text-ink">졸업식</td>
              <td className="px-2 py-1.5 text-ink">2027. 1. 9.</td>
              <td className="px-2 py-1.5 text-ink-soft">교무</td>
            </tr>
            <tr className="border-b border-line bg-custom/40">
              <td className="px-2 py-1.5 text-ink">봄 운동회</td>
              <td className="px-2 py-1.5 text-ink">2026. 3. 17.</td>
              <td className="px-2 py-1.5 text-ink-soft">체육</td>
            </tr>
            <tr className="border-b border-line bg-late/40">
              <td className="px-2 py-1.5 text-ink">가을 운동회</td>
              <td className="px-2 py-1.5 text-ink">없음</td>
              <td className="px-2 py-1.5" />
            </tr>
          </tbody>
        </table>
      </div>

      {/* A열 */}
      <section>
        <p className="mb-1.5 text-xs font-medium text-ink">A · 업무 — 무엇을 적나요</p>
        <ul className="space-y-1 text-xs text-ink-soft">
          <li>
            <Chip>앱에 있는 이름</Chip> 그대로 적으면 그 업무의 날짜를 바꿉니다. 띄어쓰기는 달라도 됩니다.
          </li>
          <li>
            <Chip tone="new">새 이름</Chip> 을 적으면 <span className="text-ink">우리 학교 행사로 새로 만듭니다.</span>{" "}
            기본 준비 절차 5단계가 붙습니다.
          </li>
        </ul>
        <button
          type="button"
          onClick={() => setOpenNames((v) => !v)}
          className="mt-2 rounded border border-line-strong px-2 py-0.5 text-[11px] text-ink-soft hover:bg-sunken"
        >
          {openNames ? "접기" : `앱에 있는 이름 ${seedTasks.length}개 보기`}
        </button>
        {openNames && (
          <div className="mt-2 flex flex-wrap gap-1 rounded border border-line bg-sunken/50 p-2">
            {seedTasks.map((t) => (
              <Chip key={t.id}>{t.title}</Chip>
            ))}
          </div>
        )}
      </section>

      {/* B열 */}
      <section>
        <p className="mb-1.5 text-xs font-medium text-ink">B · 확정일 — 무엇을 적나요</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
          <Chip>2026. 3. 17.</Chip>
          <Chip>2026-03-17</Chip>
          <Chip>2026/3/17</Chip>
          <span>중 아무 형식이나 됩니다.</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
          {OFF_LABELS.slice(0, 5).map((v) => (
            <Chip key={v} tone="off">
              {v}
            </Chip>
          ))}
          <span>
            중 하나를 적으면 <span className="text-ink">학교 전체에서 그 업무를 끕니다.</span>
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-ink-faint">
          줄을 통째로 지우는 것은 끄는 것이 아닙니다. 날짜만 없어져 기본 제안일로 돌아갑니다.
        </p>
      </section>

      {/* C열 */}
      <section>
        <p className="mb-1.5 text-xs font-medium text-ink">C · 부서 — 무엇을 적나요</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {depts.map((d) => (
            <Chip key={d}>{d}</Chip>
          ))}
          <CopyButton text={depts.join("\n")} label="부서 목록 복사" />
        </div>
        <p className="mt-1.5 text-[11px] text-ink-faint">
          비워 두면 「공통」이 됩니다. 새로 만드는 업무에만 씁니다.
        </p>
      </section>

      {/* 드롭다운 만드는 법 */}
      <section className="rounded-md border border-annual-line bg-annual/40 px-3 py-2.5">
        <p className="mb-1 text-xs font-medium text-annual-ink">
          시트에서 골라 쓰게 만들기 (선택)
        </p>
        <ol className="ml-4 list-decimal space-y-0.5 text-[11px] text-ink-soft">
          <li>부서 열 전체를 선택합니다</li>
          <li>
            메뉴에서 <span className="text-ink">데이터 → 데이터 확인</span> 을 누릅니다
          </li>
          <li>
            기준을 <span className="text-ink">드롭다운</span> 으로 놓고, 위 「부서 목록 복사」로 복사한 값을
            붙여 넣습니다
          </li>
        </ol>
        <p className="mt-1.5 text-[11px] text-ink-faint">
          확정일 열에도 같은 방법으로 「없음」을 넣어 두면 골라 쓸 수 있습니다.
        </p>
      </section>
    </div>
  );
}
