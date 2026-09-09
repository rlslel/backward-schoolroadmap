import { useState } from "react";

const STEPS = [
  {
    title: "행사일 하나만 넣으면 됩니다",
    body: "부장이 학교 공유 시트에 행사 확정일을 적으면, 그 앞뒤로 해야 할 준비 업무가 자동으로 펼쳐집니다. 시트 한 줄이 앱에서는 대여섯 줄이 됩니다.",
  },
  {
    title: "지금 해야 할 일이 먼저 보입니다",
    body: "1년치를 다 뒤질 필요가 없습니다. 홈 화면 맨 위에 기한이 지난 것과 일주일 안에 해야 할 것만 모아서 보여 줍니다.",
  },
  {
    title: "「어떻게」까지 담겨 있습니다",
    body: "각 항목의 「방법」을 누르면 기안 제목 예시, 붙임 서류, 자주 틀리는 점이 나옵니다. 기안 제목은 복사해서 그대로 쓰시면 됩니다.",
  },
];

interface Props {
  onClose: (dontShowAgain: boolean) => void;
}

export default function Onboarding({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);
  const last = step === STEPS.length - 1;

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="mb-4 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-annual-ink" : "bg-line"}`}
            />
          ))}
        </div>

        <p className="tnum mb-1 text-xs text-ink-faint">
          {step + 1} / {STEPS.length}
        </p>
        <h2 className="text-lg font-semibold text-ink">{STEPS[step].title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{STEPS[step].body}</p>

        <label className="mt-5 flex cursor-pointer items-center gap-2 text-xs text-ink-faint">
          <input
            type="checkbox"
            checked={dontShow}
            onChange={(e) => setDontShow(e.target.checked)}
            className="size-3.5 accent-ink"
          />
          다시 보지 않기
        </label>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onClose(dontShow)}
            className="rounded-md px-2 py-1.5 text-xs text-ink-faint hover:text-ink-soft"
          >
            건너뛰기
          </button>
          <span className="grow" />
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-md border border-line-strong px-3 py-1.5 text-sm text-ink-soft hover:bg-sunken"
            >
              이전
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? onClose(dontShow) : setStep((s) => s + 1))}
            className="rounded-md border border-line-strong bg-sunken px-3 py-1.5 text-sm font-medium text-ink hover:bg-line"
          >
            {last ? "시작하기" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
