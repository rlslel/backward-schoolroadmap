import { useState } from "react";
import { DEFAULT_SUBTASKS, validateCustomTask, type CustomTaskInput } from "../lib/customTask";
import { describeScope, validateMeeting, type MeetingInput } from "../lib/meeting";
import { buildShareLink } from "../lib/sheet";
import { CATEGORY_LABEL, type MeetingBody, type Task } from "../types";

interface Props {
  depts: string[];
  sheetUrl?: string;
  customTasks: Task[];
  disabledTasks: Task[];
  offByDefault: Task[];
  meetings: MeetingBody[];
  allMeetingNames: MeetingBody[];
  onAddMeeting: (input: MeetingInput) => void;
  onRemoveMeeting: (meetingId: string) => void;
  onAdd: (input: CustomTaskInput) => void;
  onRemove: (taskId: string) => void;
  onEnable: (taskId: string, enabled: boolean) => void;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-card">
      <header className="border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function TaskRow({
  task,
  action,
}: {
  task: Task;
  action: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2 border-b border-line py-1.5 text-xs last:border-0">
      <span className="min-w-0 flex-1 truncate text-ink">{task.title}</span>
      <span className="shrink-0 text-ink-faint">{CATEGORY_LABEL[task.category]}</span>
      <span className="shrink-0 text-ink-faint">{task.dept}</span>
      {action}
    </li>
  );
}

export default function SchoolSetup({
  depts,
  meetings,
  allMeetingNames,
  onAddMeeting,
  onRemoveMeeting,
  sheetUrl,
  customTasks,
  disabledTasks,
  offByDefault,
  onAdd,
  onRemove,
  onEnable,
}: Props) {
  return (
    <div className="space-y-4">
      <ShareSection sheetUrl={sheetUrl} />

      <MeetingSection
        depts={depts}
        meetings={meetings}
        allMeetingNames={allMeetingNames}
        onAdd={onAddMeeting}
        onRemove={onRemoveMeeting}
      />

      <Section
        title="우리 학교 업무 추가"
        hint="다른 학교에는 없고 우리 학교만 하는 업무를 직접 넣습니다. 담당자는 적지 않습니다."
      >
        <AddForm depts={depts} onAdd={onAdd} />

        {customTasks.length > 0 && (
          <ul className="mt-4 border-t border-line pt-2">
            {customTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                action={
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`「${task.title}」을 지웁니다. 완료 표시도 함께 사라집니다.`)) {
                        onRemove(task.id);
                      }
                    }}
                    className="shrink-0 rounded border border-line-strong px-1.5 py-0.5 text-[11px] text-late-ink hover:bg-late"
                  >
                    지우기
                  </button>
                }
              />
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="우리 학교가 하지 않는 업무"
        hint="여기 있는 업무는 화면에 나오지 않습니다. 언제든 다시 켤 수 있습니다."
      >
        {disabledTasks.length === 0 ? (
          <p className="py-2 text-xs text-ink-faint">
            꺼 둔 업무가 없습니다. 학사 일정 탭의 업무 카드에서 「끄기」를 누르면 여기에 모입니다.
          </p>
        ) : (
          <ul>
            {disabledTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                action={
                  <button
                    type="button"
                    onClick={() => onEnable(task.id, true)}
                    className="shrink-0 rounded border border-line-strong px-1.5 py-0.5 text-[11px] text-ink-soft hover:bg-sunken"
                  >
                    다시 켜기
                  </button>
                }
              />
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="우리 학교가 하는 공모·목적 사업"
        hint="해당하는 사업만 켜세요. 기본은 모두 꺼져 있습니다."
      >
        {offByDefault.length === 0 ? (
          <p className="py-2 text-xs text-ink-faint">켤 수 있는 사업을 모두 켰습니다.</p>
        ) : (
          <ul>
            {offByDefault.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                action={
                  <button
                    type="button"
                    onClick={() => onEnable(task.id, true)}
                    className="shrink-0 rounded border border-line-strong px-1.5 py-0.5 text-[11px] text-ink-soft hover:bg-sunken"
                  >
                    켜기
                  </button>
                }
              />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function ShareSection({ sheetUrl }: { sheetUrl?: string }) {
  const [copied, setCopied] = useState(false);
  const link = sheetUrl ? buildShareLink(window.location.href, sheetUrl) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Section
      title="학교 일정 시트"
      hint="부장이 시트에 행사일을 적으면 이 앱에 반영됩니다. 앱은 시트를 읽기만 합니다."
    >
      {!sheetUrl ? (
        <p className="text-xs text-ink-soft">
          아직 시트가 연결되지 않았습니다. 시트를 「파일 → 공유 → 웹에 게시 → CSV」로 게시한 뒤,
          그 주소를 담은 링크로 접속하면 연결됩니다.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="break-all rounded bg-sunken px-2 py-1.5 text-[11px] text-ink-soft">{sheetUrl}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded border border-line-strong px-2 py-1 text-xs text-ink hover:bg-sunken"
            >
              {copied ? "복사됨" : "전 교직원에게 보낼 링크 복사"}
            </button>
            <span className="text-xs text-ink-faint">
              이 링크를 받은 사람은 아무 설정 없이 학교 일정을 봅니다.
            </span>
          </div>
        </div>
      )}
    </Section>
  );
}

const 빈항목 = () => ({ title: "", offsetDays: 0 });

function AddForm({ depts, onAdd }: { depts: string[]; onAdd: (input: CustomTaskInput) => void }) {
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState(depts[0] ?? "공통");
  const [date, setDate] = useState("");
  const [subtasks, setSubtasks] = useState(
    DEFAULT_SUBTASKS.map((s) => ({ title: s.title, offsetDays: s.offsetDays })),
  );
  const [errors, setErrors] = useState<string[]>([]);

  const reset = () => {
    setTitle("");
    setDate("");
    setSubtasks(DEFAULT_SUBTASKS.map((s) => ({ title: s.title, offsetDays: s.offsetDays })));
    setErrors([]);
  };

  const submit = () => {
    const input: CustomTaskInput = { title, dept, date, subtasks };
    const result = validateCustomTask(input);
    setErrors(result.errors);
    if (!result.ok) return;
    onAdd(input);
    reset();
  };

  const 항목수정 = (i: number, patch: Partial<{ title: string; offsetDays: number }>) => {
    setSubtasks((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    setErrors([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-48 grow flex-col gap-1">
          <span className="text-xs text-ink-soft">업무 이름</span>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setErrors([]);
            }}
            placeholder="예: 우리 학교 독서 축제"
            className="rounded border border-line-strong bg-card px-2 py-1.5 text-sm text-ink"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-soft">부서</span>
          <select
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="rounded border border-line-strong bg-card px-2 py-1.5 text-sm text-ink"
          >
            {depts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-soft">행사일</span>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setErrors([]);
            }}
            className="tnum rounded border border-line-strong bg-card px-2 py-1.5 text-sm text-ink"
          />
        </label>
      </div>

      <div>
        <p className="mb-1 text-xs text-ink-soft">
          준비 항목 <span className="text-ink-faint">— 행사일 기준 며칠 전(음수)·며칠 후(양수)</span>
        </p>
        <ul className="space-y-1">
          {subtasks.map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                type="number"
                value={s.offsetDays}
                onChange={(e) => 항목수정(i, { offsetDays: Number(e.target.value) })}
                aria-label={`${i + 1}번째 항목 날짜 간격`}
                className="tnum w-20 rounded border border-line-strong bg-card px-2 py-1 text-sm text-ink"
              />
              <input
                value={s.title}
                onChange={(e) => 항목수정(i, { title: e.target.value })}
                aria-label={`${i + 1}번째 항목 이름`}
                placeholder="할 일"
                className="min-w-0 flex-1 rounded border border-line-strong bg-card px-2 py-1 text-sm text-ink"
              />
              <button
                type="button"
                onClick={() => setSubtasks((prev) => prev.filter((_, idx) => idx !== i))}
                aria-label={`${i + 1}번째 항목 지우기`}
                className="shrink-0 rounded border border-line-strong px-2 py-1 text-xs text-ink-faint hover:bg-sunken"
              >
                −
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setSubtasks((prev) => [...prev, 빈항목()])}
          className="mt-1.5 rounded border border-line-strong px-2 py-1 text-xs text-ink-soft hover:bg-sunken"
        >
          준비 항목 추가
        </button>
      </div>

      {errors.length > 0 && (
        <ul className="space-y-0.5 rounded border border-late-line bg-late px-3 py-2">
          {errors.map((e) => (
            <li key={e} className="text-xs text-late-ink">
              {e}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={submit}
        className="rounded border border-line-strong bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-sunken"
      >
        추가
      </button>
    </div>
  );
}

// ── 회의체 ────────────────────────────────────────────────────────

function MeetingSection({
  depts,
  meetings,
  allMeetingNames,
  onAdd,
  onRemove,
}: {
  depts: string[];
  meetings: MeetingBody[];
  allMeetingNames: MeetingBody[];
  onAdd: (input: MeetingInput) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [pickedDepts, setPickedDepts] = useState<string[]>([]);
  const [pickedGrades, setPickedGrades] = useState<number[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const submit = () => {
    const input: MeetingInput = { name, note, depts: pickedDepts, grades: pickedGrades, taskIds: [] };
    const found = validateMeeting(input, allMeetingNames);
    setErrors(found);
    if (found.length > 0) return;
    onAdd(input);
    setName("");
    setNote("");
    setPickedDepts([]);
    setPickedGrades([]);
  };

  return (
    <Section
      title="회의체"
      hint="학교마다 회의 이름과 묶는 방식이 다릅니다. 우리 학교 회의를 직접 만들어 두면 회의 안건 탭에서 고를 수 있습니다."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-40 grow flex-col gap-1">
            <span className="text-xs text-ink-soft">회의 이름</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors([]);
              }}
              placeholder="예: 미래두레, 3학년 교실마실"
              className="rounded border border-line-strong bg-card px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <label className="flex min-w-32 flex-col gap-1">
            <span className="text-xs text-ink-soft">주기 (선택)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="예: 매주 화요일"
              className="rounded border border-line-strong bg-card px-2 py-1.5 text-sm text-ink"
            />
          </label>
        </div>

        <div>
          <p className="mb-1 text-xs text-ink-soft">
            어떤 업무를 볼까요 <span className="text-ink-faint">— 아무것도 안 고르면 전체를 봅니다</span>
          </p>
          <div className="flex flex-wrap gap-1">
            {depts.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setPickedDepts((p) => toggle(p, d))}
                className={`rounded border px-2 py-1 text-xs ${
                  pickedDepts.includes(d)
                    ? "border-annual-ink bg-annual text-annual-ink"
                    : "border-line-strong text-ink-soft hover:bg-sunken"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5, 6].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setPickedGrades((p) => toggle(p, g))}
                className={`rounded border px-2 py-1 text-xs ${
                  pickedGrades.includes(g)
                    ? "border-annual-ink bg-annual text-annual-ink"
                    : "border-line-strong text-ink-soft hover:bg-sunken"
                }`}
              >
                {g}학년
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">
            범위 · {describeScope({ id: "", name: "", depts: pickedDepts, grades: pickedGrades, taskIds: [] })}
          </p>
        </div>

        {errors.length > 0 && (
          <ul className="space-y-0.5 rounded border border-late-line bg-late px-3 py-2">
            {errors.map((e) => (
              <li key={e} className="text-xs text-late-ink">
                {e}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={submit}
          className="rounded border border-line-strong bg-card px-3 py-1.5 text-sm font-medium text-ink hover:bg-sunken"
        >
          회의 추가
        </button>
      </div>

      {meetings.length > 0 && (
        <ul className="mt-4 border-t border-line pt-2">
          {meetings.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 border-b border-line py-1.5 text-xs last:border-0"
            >
              <span className="shrink-0 font-medium text-ink">{m.name}</span>
              {m.note && <span className="shrink-0 text-ink-faint">{m.note}</span>}
              <span className="min-w-0 flex-1 truncate text-ink-soft">{describeScope(m)}</span>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`「${m.name}」 회의를 지웁니다.`)) onRemove(m.id);
                }}
                className="shrink-0 rounded border border-line-strong px-1.5 py-0.5 text-[11px] text-late-ink hover:bg-late"
              >
                지우기
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
