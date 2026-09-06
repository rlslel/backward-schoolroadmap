// 1단계 확인용 임시 화면. 2단계부터 실제 내용으로 교체한다.
const 프로토콜 = window.location.protocol;
const 실행방식 =
  프로토콜 === "file:" ? "단일 HTML 파일 (오프라인)" : "웹 링크";

function 줄({ 항목, 값, 강조 }: { 항목: string; 값: string; 강조?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-slate-500">{항목}</dt>
      <dd className={강조 ? "font-medium text-emerald-600" : "font-medium"}>{값}</dd>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold">학교업무 역산 로드맵</h1>
        <p className="mt-2 text-slate-600">
          1단계 빌드 확인용 화면입니다. 실제 화면은 4단계에서 만듭니다.
        </p>
        <dl className="mt-6 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          <줄 항목="실행 방식" 값={실행방식} />
          <줄 항목="React" 값="동작함" 강조 />
          <줄 항목="Tailwind" 값="적용됨" 강조 />
          <줄 항목="외부 요청" 값="0건" 강조 />
        </dl>
      </div>
    </div>
  );
}
