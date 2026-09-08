import type { AgendaEntry, PendingDecision } from "../lib/agenda";
import { agendaTitle } from "../lib/agenda";
import { formatKo } from "../lib/dates";

interface Props {
  schoolYear: number;
  today: Date;
  dept: string;
  agenda: AgendaEntry[];
  pending: PendingDecision[];
}

/**
 * 인쇄해서 회의에 들고 갈 협의 안건 양식.
 *
 * 담당자를 적는 칸은 손으로 쓰도록 비워 둔다. 앱에 성명을 저장하지 않기 위해서다.
 * 인쇄는 브라우저 인쇄 기능(window.print)과 인쇄 전용 CSS 로 처리한다.
 */
export default function AgendaSheet({ schoolYear, today, dept, agenda, pending }: Props) {
  const 안건있음 = agenda.length > 0 || pending.length > 0;

  // 없는 항목은 건너뛰되 번호는 이어지게 매긴다. 1 다음에 3이 나오면 빠진 줄 안다.
  let 번호 = 0;
  const 다음번호 = () => (번호 += 1);

  return (
    <div className="print-sheet rounded-lg border border-line bg-card p-6">
      <header className="mb-4 border-b-2 border-ink pb-3">
        <h2 className="text-lg font-semibold text-ink">{agendaTitle(schoolYear, today, dept)}</h2>
        <p className="mt-1 text-xs text-ink-soft">
          작성일 {formatKo(today)} · 앞으로 한 달 안에 처리해야 할 항목
        </p>
      </header>

      {!안건있음 && (
        <p className="py-8 text-center text-sm text-ink-faint">이번 달 이 부서에서 다룰 안건이 없습니다.</p>
      )}

      {agenda.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-ink">{다음번호()}. 처리할 업무</h3>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-line-strong bg-sunken text-ink-soft">
                <th className="w-8 px-2 py-1.5 text-left font-medium">번호</th>
                <th className="px-2 py-1.5 text-left font-medium">업무</th>
                <th className="px-2 py-1.5 text-left font-medium">할 일</th>
                <th className="w-24 px-2 py-1.5 text-left font-medium">기한</th>
                <th className="w-24 px-2 py-1.5 text-left font-medium">담당</th>
                <th className="w-32 px-2 py-1.5 text-left font-medium">결정 사항</th>
              </tr>
            </thead>
            <tbody>
              {agenda.flatMap((entry, ei) =>
                entry.items.map((item, ii) => (
                  <tr key={item.key} className="border-b border-line align-top">
                    <td className="tnum px-2 py-1.5 text-ink-faint">{ii === 0 ? ei + 1 : ""}</td>
                    <td className="px-2 py-1.5 text-ink">{ii === 0 ? entry.task.task.title : ""}</td>
                    <td className="px-2 py-1.5 text-ink-soft">
                      {item.subtask.title}
                      {item.status === "late" && (
                        <span className="ml-1 text-late-ink">({-item.days}일 지남)</span>
                      )}
                    </td>
                    <td className="tnum px-2 py-1.5 text-ink-soft">{item.dateText}</td>
                    <td className="px-2 py-1.5" />
                    <td className="px-2 py-1.5" />
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </section>
      )}

      {pending.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-ink">{다음번호()}. 정해야 할 것</h3>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-y border-line-strong bg-sunken text-ink-soft">
                <th className="w-8 px-2 py-1.5 text-left font-medium">번호</th>
                <th className="px-2 py-1.5 text-left font-medium">업무</th>
                <th className="w-28 px-2 py-1.5 text-left font-medium">확인할 내용</th>
                <th className="w-24 px-2 py-1.5 text-left font-medium">현재 표시일</th>
                <th className="w-40 px-2 py-1.5 text-left font-medium">결정 사항</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p, i) => (
                <tr key={p.view.task.id} className="border-b border-line">
                  <td className="tnum px-2 py-1.5 text-ink-faint">{i + 1}</td>
                  <td className="px-2 py-1.5 text-ink">{p.view.task.title}</td>
                  <td className="px-2 py-1.5 text-ink-soft">{p.reasons.join(" · ")}</td>
                  <td className="tnum px-2 py-1.5 text-ink-soft">{p.view.anchorText}</td>
                  <td className="px-2 py-1.5" />
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-ink">{다음번호()}. 기타 협의 사항</h3>
        <div className="space-y-5 pt-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-b border-line" />
          ))}
        </div>
      </section>

      <p className="mt-8 border-t border-line pt-3 text-center text-[11px] text-ink-faint">
        본 일정은 참고용 표준안이며, 최종 시행일은 소속 학교·교육청 지침을 따릅니다.
      </p>
    </div>
  );
}
