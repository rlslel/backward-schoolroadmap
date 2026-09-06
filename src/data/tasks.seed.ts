// 초등학교 공통 업무 시드 데이터.
//
// ── 이 파일을 고칠 때 반드시 지킬 것 ──────────────────────────────
// 1. id 는 한 번 정하면 절대 바꾸지 않는다. 바꾸면 사용자의 완료 체크와 수정한 날짜가
//    조용히 사라진다. 제목이 바뀌어도 id 는 그대로 둔다.
// 2. 법정 업무의 시행 시기와 근거 법령은 추측해서 채우지 않는다. 확인된 것만 basis 에 적는다.
//    잘못된 날짜는 업무 간소화가 아니라 새로운 감사 위험이 된다.
// 3. anchor 의 week 값은 "대략 이맘때"라는 뜻의 임시 배치다. 학교에서 확정하면
//    시트에 실제 날짜를 적어 덮어쓴다.
//
// ── basis 가 비어 있다는 것의 뜻 ──────────────────────────────────
// - category "legal"  → 근거를 아직 못 채운 것이다. 화면에 「근거 확인 필요」로 경고한다.
// - 그 외 분류        → 원래 법적 근거가 없는 업무다. 아무것도 표시하지 않는다.

import type { SubTask, Task } from "../types";

export const DEPTS = [
  "공통",
  "교무",
  "연구",
  "생활",
  "체육",
  "보건",
  "정보",
  "방과후",
] as const;

/** 행사류에 공통으로 붙는 마무리 절차. 세부 내용은 업무마다 덮어쓴다. */
function 정산(draftTitle: string, offsetDays = 5): SubTask {
  return {
    id: "settle",
    title: "예산 집행 정산",
    offsetDays,
    draftTitle,
    attachments: ["지출 결의서", "거래 명세서", "결과 보고서"],
    caution: "회계연도 마감 전에 정산을 끝낸다. 미루면 이월 처리가 복잡해진다.",
  };
}

// ══════════════════════════════════════════════════════════════════
// 1. 법정 · 필수 공통
//    아래 11건은 basis 를 모두 비워 두었다. 시행 시기와 근거가 시도·연도별로 다르므로
//    추측으로 채우지 않았다. 실제 지침을 확인해 채워 넣을 것.
// ══════════════════════════════════════════════════════════════════
const LEGAL: Task[] = [
  {
    id: "curriculum-plan",
    title: "학교교육과정 편성·운영 계획 수립",
    category: "legal",
    dept: "연구",
    anchor: { mode: "week", month: 2, week: 2 },
    // TODO: 근거 확인 필요 — 초·중등교육법 및 시도 교육과정 편성·운영 지침
    enabled: true,
    subtasks: [
      { id: "draft", title: "부서별 운영 계획 취합", offsetDays: -30, attachments: ["부서별 계획서"] },
      { id: "committee", title: "교육과정위원회 심의", offsetDays: -14 },
      { id: "approve", title: "학교운영위원회 심의 상정", offsetDays: -7 },
      { id: "publish", title: "확정 및 학교 홈페이지 공개", offsetDays: 0 },
    ],
  },
  {
    id: "school-committee",
    title: "학교운영위원회 구성",
    category: "legal",
    dept: "공통",
    anchor: { mode: "week", month: 3, week: 2 },
    // TODO: 근거 확인 필요 — 초·중등교육법 및 시도 학교운영위원회 설치·운영 조례
    enabled: true,
    subtasks: [
      { id: "notice", title: "위원 선출 공고", offsetDays: -21, attachments: ["선출 공고문"] },
      { id: "candidate", title: "후보자 등록 접수", offsetDays: -14 },
      {
        id: "vote",
        title: "선출 투표 실시",
        offsetDays: -7,
        caution: "학부모위원은 학부모 전체를 대상으로 선출한다. 대표만 모아 뽑으면 절차 하자가 된다.",
      },
      { id: "compose", title: "위원회 구성 및 보고", offsetDays: 0 },
    ],
  },
  {
    id: "violence-prevention",
    title: "학교폭력 예방교육",
    category: "legal",
    dept: "생활",
    anchor: { mode: "week", month: 3, week: 4 },
    // TODO: 근거 확인 필요 — 학교폭력예방 및 대책에 관한 법률. 실시 횟수·대상 확인
    enabled: true,
    subtasks: [
      { id: "plan", title: "연간 실시 계획 수립", offsetDays: -21, draftTitle: "학교폭력 예방교육 실시 계획" },
      { id: "notice", title: "학부모 대상 안내", offsetDays: -7, attachments: ["가정통신문(안)"] },
      { id: "run", title: "학생·교직원 교육 실시", offsetDays: 0 },
      {
        id: "report",
        title: "실시 결과 보고 및 증빙 정리",
        offsetDays: 7,
        caution: "이수 명단과 사진은 감사 대비 증빙이다. 그때그때 정리해 두지 않으면 나중에 못 찾는다.",
      },
    ],
  },
  {
    id: "health-checkup",
    title: "학생 건강검사",
    category: "legal",
    dept: "보건",
    anchor: { mode: "week", month: 4, week: 2 },
    // TODO: 근거 확인 필요 — 학교보건법. 검진 대상 학년과 시기 확인
    enabled: true,
    subtasks: [
      { id: "contract", title: "검진기관 선정 및 계약", offsetDays: -30, attachments: ["견적서 3부", "계약 서류"] },
      {
        id: "consent",
        title: "학부모 안내 및 동의서 수합",
        offsetDays: -14,
        attachments: ["가정통신문(안)", "동의서 양식"],
      },
      { id: "run", title: "검사 실시", offsetDays: 0 },
      { id: "record", title: "결과 통보 및 건강기록부 입력", offsetDays: 14 },
    ],
  },
  {
    id: "safety-education",
    title: "학교 안전교육 (1학기)",
    category: "legal",
    dept: "생활",
    anchor: { mode: "week", month: 4, week: 1 },
    // TODO: 근거 확인 필요 — 학교안전사고 예방 및 보상에 관한 법률. 영역별 시수 확인
    enabled: true,
    subtasks: [
      {
        id: "plan",
        title: "영역별 시수 배정 계획 수립",
        offsetDays: -21,
        caution: "영역별 최소 시수를 채웠는지 계획 단계에서 확인한다. 학기 말에 발견하면 못 채운다.",
      },
      { id: "run", title: "교육 실시", offsetDays: 0 },
      { id: "report", title: "실시 결과 정리", offsetDays: 7 },
    ],
  },
  {
    id: "info-disclosure-1",
    title: "학교 정보공시 (1차)",
    category: "legal",
    dept: "공통",
    anchor: { mode: "week", month: 4, week: 3 },
    // TODO: 근거 확인 필요 — 교육관련기관의 정보공개에 관한 특례법. 공시 항목과 마감일 확인
    enabled: true,
    subtasks: [
      {
        id: "request",
        title: "부서별 자료 제출 요청",
        offsetDays: -21,
        draftTitle: "학교 정보공시 자료 제출 요청",
        attachments: ["항목별 제출 양식"],
      },
      { id: "collect", title: "자료 취합", offsetDays: -10 },
      {
        id: "review",
        title: "입력 내용 검토",
        offsetDays: -3,
        caution: "전년도 대비 수치가 크게 바뀐 항목은 근거를 다시 확인한다.",
      },
      { id: "submit", title: "공시 입력 마감", offsetDays: 0 },
    ],
  },
  {
    id: "four-violence-edu",
    title: "4대 폭력 예방교육",
    category: "legal",
    dept: "생활",
    anchor: { mode: "week", month: 5, week: 2 },
    // TODO: 근거 확인 필요 — 성폭력·성매매·가정폭력·성희롱 예방교육 각각의 근거와 시수 확인
    enabled: true,
    subtasks: [
      { id: "plan", title: "실시 계획 수립", offsetDays: -21 },
      {
        id: "run",
        title: "학생·교직원 교육 실시",
        offsetDays: 0,
        caution: "교직원 교육은 학생 교육과 별도로 실시하고 따로 증빙해야 한다.",
      },
      { id: "report", title: "실시 결과 등록", offsetDays: 7 },
    ],
  },
  {
    id: "disaster-drill",
    title: "재난 대비 대피훈련",
    category: "legal",
    dept: "생활",
    anchor: { mode: "week", month: 5, week: 3 },
    // TODO: 근거 확인 필요 — 실시 횟수와 소방서 합동 실시 여부 확인
    enabled: true,
    subtasks: [
      {
        id: "plan",
        title: "훈련 계획 수립 및 관계 기관 협의",
        offsetDays: -21,
        attachments: ["훈련 계획서", "대피 경로도"],
      },
      { id: "notice", title: "교직원 사전 안내", offsetDays: -3 },
      { id: "run", title: "훈련 실시", offsetDays: 0 },
      { id: "report", title: "결과 보고 및 개선 사항 정리", offsetDays: 7 },
    ],
  },
  {
    id: "child-abuse-edu",
    title: "아동학대 예방 및 신고의무자 교육",
    category: "legal",
    dept: "생활",
    anchor: { mode: "week", month: 6, week: 2 },
    // TODO: 근거 확인 필요 — 아동복지법. 신고의무자 교육 시수와 주기 확인
    enabled: true,
    subtasks: [
      { id: "plan", title: "실시 계획 수립", offsetDays: -14 },
      { id: "run", title: "교직원 교육 실시", offsetDays: 0 },
      { id: "report", title: "이수 확인 및 증빙 정리", offsetDays: 7 },
    ],
  },
  {
    id: "info-disclosure-2",
    title: "학교 정보공시 (2차)",
    category: "legal",
    dept: "공통",
    anchor: { mode: "week", month: 9, week: 1 },
    // TODO: 근거 확인 필요 — 1차와 공시 항목이 다르므로 별도로 확인
    enabled: true,
    subtasks: [
      {
        id: "request",
        title: "부서별 자료 제출 요청",
        offsetDays: -21,
        draftTitle: "학교 정보공시 자료 제출 요청",
        attachments: ["항목별 제출 양식"],
      },
      { id: "collect", title: "자료 취합", offsetDays: -10 },
      { id: "review", title: "입력 내용 검토", offsetDays: -3 },
      { id: "submit", title: "공시 입력 마감", offsetDays: 0 },
    ],
  },
  {
    id: "school-evaluation",
    title: "학교 자체평가",
    category: "legal",
    dept: "연구",
    anchor: { mode: "week", month: 11, week: 3 },
    // TODO: 근거 확인 필요 — 초·중등교육법 및 시도 학교평가 시행 계획
    enabled: true,
    subtasks: [
      { id: "survey", title: "학생·학부모·교직원 만족도 조사", offsetDays: -30, attachments: ["설문 문항"] },
      { id: "analyze", title: "결과 분석 및 지표 정리", offsetDays: -14 },
      { id: "report-draft", title: "자체평가 보고서 작성", offsetDays: -7 },
      { id: "submit", title: "보고서 제출 및 공개", offsetDays: 0 },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════
// 2. 통상 학사 · 연례 행사
//    앵커 역산이 가장 강하게 작동하는 영역이다. 법적 근거가 없는 것이 정상이다.
// ══════════════════════════════════════════════════════════════════
const ANNUAL: Task[] = [
  {
    id: "entrance-ceremony",
    title: "입학식",
    category: "annual",
    dept: "교무",
    grades: [1],
    anchor: { mode: "week", month: 3, week: 1 },
    enabled: true,
    subtasks: [
      { id: "plan", title: "행사 계획 수립 및 역할 분담", offsetDays: -14, draftTitle: "○○학년도 입학식 운영 계획" },
      {
        id: "supplies",
        title: "물품 구입 품의",
        offsetDays: -10,
        attachments: ["견적서 3부", "물품 내역서"],
        caution: "견적은 3개 업체가 필요하다. 회신이 늦으므로 미리 요청한다.",
      },
      { id: "notice", title: "신입생 학부모 안내", offsetDays: -7, attachments: ["가정통신문(안)"] },
      { id: "run", title: "입학식 실시", offsetDays: 0 },
      정산("입학식 예산 집행 정산"),
    ],
  },
  {
    id: "parents-meeting",
    title: "학부모총회",
    category: "annual",
    dept: "교무",
    anchor: { mode: "week", month: 3, week: 3 },
    enabled: true,
    subtasks: [
      { id: "plan", title: "총회 운영 계획 수립", offsetDays: -21, draftTitle: "○○학년도 학부모총회 운영 계획" },
      {
        id: "notice",
        title: "가정통신문 발송 및 참석 수요 조사",
        offsetDays: -10,
        attachments: ["가정통신문(안)", "참석 회신서"],
        caution: "회신 마감을 총회 1주 전으로 잡아야 다과와 자료 수량을 맞출 수 있다.",
      },
      { id: "material", title: "학교 교육과정 설명 자료 준비", offsetDays: -5, attachments: ["설명회 자료"] },
      { id: "run", title: "총회 및 학급별 간담회 실시", offsetDays: 0 },
      { id: "elect", title: "학부모회 임원 구성 결과 정리", offsetDays: 3 },
    ],
  },
  {
    id: "open-class-1",
    title: "1학기 학부모 공개수업",
    category: "annual",
    dept: "연구",
    anchor: { mode: "week", month: 4, week: 4 },
    enabled: true,
    subtasks: [
      { id: "plan", title: "운영 계획 수립 및 학급별 일정 확정", offsetDays: -21 },
      { id: "notice", title: "가정통신문 발송", offsetDays: -10, attachments: ["가정통신문(안)"] },
      { id: "prepare", title: "학급별 수업 지도안 취합", offsetDays: -3 },
      { id: "run", title: "공개수업 실시", offsetDays: 0 },
      { id: "survey", title: "학부모 설문 정리", offsetDays: 5 },
    ],
  },
  {
    id: "field-trip-spring",
    title: "봄 현장체험학습",
    category: "annual",
    dept: "교무",
    anchor: { mode: "week", month: 5, week: 1 },
    enabled: true,
    subtasks: [
      {
        id: "plan",
        title: "장소 답사 및 운영 계획 수립",
        offsetDays: -35,
        attachments: ["답사 보고서", "운영 계획서"],
        caution: "답사 없이 계획을 올리면 안전 점검을 했다는 근거가 남지 않는다.",
      },
      {
        id: "bus",
        title: "전세버스 계약 품의",
        offsetDays: -28,
        attachments: ["견적서 3부", "차량 안전 점검 확인서"],
        caution: "성수기에는 버스 확보가 어렵다. 날짜가 정해지면 바로 잡는다.",
      },
      {
        id: "safety",
        title: "안전관리 계획 수립",
        offsetDays: -21,
        attachments: ["안전관리 계획서", "인솔 교사 배치표"],
      },
      {
        id: "consent",
        title: "가정통신문 발송 및 참가 동의서 수합",
        offsetDays: -14,
        attachments: ["가정통신문(안)", "참가 동의서"],
        caution: "미참가 학생의 교내 지도 계획을 함께 세워야 한다.",
      },
      { id: "final", title: "최종 인원 확정 및 사전 안전교육", offsetDays: -3 },
      { id: "run", title: "현장체험학습 실시", offsetDays: 0 },
      정산("봄 현장체험학습 예산 집행 정산"),
    ],
  },
  {
    id: "sports-club",
    title: "학교스포츠클럽 대회",
    category: "annual",
    dept: "체육",
    anchor: { mode: "week", month: 6, week: 2 },
    enabled: true,
    subtasks: [
      { id: "plan", title: "대회 운영 계획 수립", offsetDays: -21 },
      { id: "team", title: "참가 팀 등록 및 명단 확정", offsetDays: -14 },
      { id: "supplies", title: "물품·간식 구입 품의", offsetDays: -10, attachments: ["견적서 3부"] },
      { id: "run", title: "대회 실시", offsetDays: 0 },
      정산("학교스포츠클럽 대회 예산 집행 정산"),
    ],
  },
  {
    id: "career-week",
    title: "진로교육 주간",
    category: "annual",
    dept: "연구",
    anchor: { mode: "week", month: 6, week: 3 },
    enabled: true,
    subtasks: [
      { id: "plan", title: "주간 운영 계획 수립", offsetDays: -21 },
      {
        id: "invite",
        title: "외부 강사 섭외 및 계약",
        offsetDays: -14,
        attachments: ["강사 이력", "강사료 지급 품의"],
        caution: "강사료 지급 기준은 학교 회계 지침을 먼저 확인한다.",
      },
      { id: "notice", title: "가정통신문 발송", offsetDays: -7, attachments: ["가정통신문(안)"] },
      { id: "run", title: "진로교육 주간 운영", offsetDays: 0 },
      정산("진로교육 주간 예산 집행 정산"),
    ],
  },
  {
    id: "summer-vacation",
    title: "여름방학식",
    category: "annual",
    dept: "교무",
    anchor: { mode: "week", month: 7, week: 4 },
    enabled: true,
    subtasks: [
      { id: "notice", title: "방학 중 생활 안내 가정통신문", offsetDays: -7, attachments: ["가정통신문(안)"] },
      { id: "safety", title: "방학 중 안전교육 실시", offsetDays: -3 },
      { id: "run", title: "방학식", offsetDays: 0 },
    ],
  },
  {
    id: "sports-day",
    title: "가을 운동회",
    category: "annual",
    dept: "체육",
    anchor: { mode: "week", month: 9, week: 2 },
    enabled: true,
    subtasks: [
      { id: "plan", title: "운영 계획 수립 및 종목 확정", offsetDays: -35, draftTitle: "○○학년도 가을 운동회 운영 계획" },
      {
        id: "quote",
        title: "물품 구입 품의",
        offsetDays: -30,
        draftTitle: "○○학년도 가을 운동회 물품 구입 품의",
        attachments: ["견적서 3부", "물품 내역서"],
        caution: "견적은 3개 업체 필수. 업체 회신이 늦으므로 D-35에 미리 요청한다.",
      },
      {
        id: "safety",
        title: "안전관리 계획 수립",
        offsetDays: -14,
        attachments: ["안전관리 계획서", "보건 지원 계획"],
        caution: "보건교사와 사전 협의를 빠뜨리는 경우가 많다.",
      },
      {
        id: "notice",
        title: "가정통신문 발송",
        offsetDays: -7,
        attachments: ["가정통신문(안)"],
        caution: "우천 시 순연일을 반드시 함께 안내한다.",
      },
      { id: "final", title: "전일 최종 점검 및 장소 준비", offsetDays: -1 },
      { id: "run", title: "운동회 실시", offsetDays: 0 },
      정산("○○학년도 가을 운동회 예산 집행 정산"),
    ],
  },
  {
    id: "school-trip",
    title: "수학여행",
    category: "annual",
    dept: "교무",
    grades: [6],
    anchor: { mode: "week", month: 10, week: 2 },
    enabled: true,
    subtasks: [
      {
        id: "survey",
        title: "학부모 수요 조사",
        offsetDays: -70,
        attachments: ["수요 조사서"],
        caution: "수학여행은 준비 기간이 가장 길다. 학기 초에 시작하지 않으면 일정이 밀린다.",
      },
      { id: "committee", title: "수학여행 활성화 위원회 심의", offsetDays: -56 },
      {
        id: "contract",
        title: "업체 선정 및 계약",
        offsetDays: -42,
        attachments: ["제안서", "계약 서류", "차량 안전 점검 확인서"],
      },
      { id: "briefing", title: "학부모 설명회", offsetDays: -28, attachments: ["설명회 자료"] },
      {
        id: "safety",
        title: "안전관리 계획 수립 및 사전 답사",
        offsetDays: -21,
        attachments: ["안전관리 계획서", "답사 보고서"],
      },
      {
        id: "consent",
        title: "참가 동의서 수합 및 최종 인원 확정",
        offsetDays: -14,
        attachments: ["참가 동의서"],
        caution: "미참가 학생의 교내 지도 계획을 함께 세운다.",
      },
      { id: "run", title: "수학여행 실시", offsetDays: 0 },
      정산("수학여행 예산 집행 정산", 7),
    ],
  },
  {
    id: "open-class-2",
    title: "2학기 학부모 공개수업",
    category: "annual",
    dept: "연구",
    anchor: { mode: "week", month: 10, week: 3 },
    enabled: true,
    subtasks: [
      { id: "plan", title: "운영 계획 수립 및 학급별 일정 확정", offsetDays: -21 },
      { id: "notice", title: "가정통신문 발송", offsetDays: -10, attachments: ["가정통신문(안)"] },
      { id: "run", title: "공개수업 실시", offsetDays: 0 },
      { id: "survey", title: "학부모 설문 정리", offsetDays: 5 },
    ],
  },
  {
    id: "art-festival",
    title: "학예회",
    category: "annual",
    dept: "교무",
    anchor: { mode: "week", month: 11, week: 3 },
    enabled: true,
    subtasks: [
      {
        id: "plan",
        title: "운영 계획 수립 및 학급별 종목 취합",
        offsetDays: -42,
        draftTitle: "○○학년도 학예회 운영 계획",
      },
      {
        id: "supplies",
        title: "무대·의상·물품 구입 품의",
        offsetDays: -28,
        attachments: ["견적서 3부", "물품 내역서"],
      },
      {
        id: "safety",
        title: "안전관리 및 관람 동선 계획",
        offsetDays: -14,
        attachments: ["안전관리 계획서", "좌석 배치도"],
      },
      {
        id: "notice",
        title: "가정통신문 발송",
        offsetDays: -10,
        attachments: ["가정통신문(안)"],
        caution: "학부모 관람 인원과 주차 안내를 함께 넣는다.",
      },
      { id: "rehearsal", title: "전체 리허설", offsetDays: -2 },
      { id: "run", title: "학예회 실시", offsetDays: 0 },
      정산("학예회 예산 집행 정산"),
    ],
  },
  {
    id: "winter-vacation",
    title: "겨울방학식",
    category: "annual",
    dept: "교무",
    anchor: { mode: "week", month: 12, week: 4 },
    enabled: true,
    subtasks: [
      { id: "notice", title: "방학 중 생활 안내 가정통신문", offsetDays: -7, attachments: ["가정통신문(안)"] },
      { id: "safety", title: "방학 중 안전교육 실시", offsetDays: -3 },
      { id: "run", title: "방학식", offsetDays: 0 },
    ],
  },
  {
    id: "graduation",
    title: "졸업식",
    category: "annual",
    dept: "교무",
    grades: [6],
    // 2026학년도의 1월은 2027년 1월이다. 학년도 경계가 걸리는 대표 업무.
    anchor: { mode: "week", month: 1, week: 2 },
    enabled: true,
    subtasks: [
      { id: "plan", title: "졸업식 운영 계획 수립", offsetDays: -30, draftTitle: "○○학년도 졸업식 운영 계획" },
      {
        id: "award",
        title: "졸업장·상장 제작 품의",
        offsetDays: -21,
        attachments: ["견적서 3부", "수상자 명단"],
        caution: "상장 문구와 수여자 직위를 미리 확정해야 재제작을 피한다.",
      },
      {
        id: "record",
        title: "학교생활기록부 마감 점검",
        offsetDays: -14,
        caution: "정정 사항은 마감 전에 처리한다. 마감 후에는 절차가 복잡해진다.",
      },
      { id: "notice", title: "가정통신문 발송", offsetDays: -7, attachments: ["가정통신문(안)"] },
      { id: "run", title: "졸업식 실시", offsetDays: 0 },
      정산("졸업식 예산 집행 정산"),
    ],
  },
];

// ══════════════════════════════════════════════════════════════════
// 3. 공모 · 목적 사업 — 해당 학교만 켜서 쓴다. 기본은 전부 꺼짐.
// ══════════════════════════════════════════════════════════════════
const GRANT: Task[] = [
  {
    id: "neulbom",
    title: "늘봄학교 운영",
    category: "grant",
    dept: "방과후",
    anchor: { mode: "week", month: 3, week: 1 },
    enabled: false,
    subtasks: [
      { id: "plan", title: "연간 운영 계획 수립", offsetDays: -21 },
      { id: "recruit", title: "강사 모집 및 계약", offsetDays: -14, attachments: ["강사 이력", "계약 서류"] },
      { id: "apply", title: "학생 신청 접수 및 반 편성", offsetDays: -7, attachments: ["신청서 양식"] },
      { id: "run", title: "운영 개시", offsetDays: 0 },
      { id: "report", title: "운영 실적 보고", offsetDays: 30 },
    ],
  },
  {
    id: "ai-leading-school",
    title: "AI 선도학교 운영",
    category: "grant",
    dept: "정보",
    anchor: { mode: "week", month: 4, week: 1 },
    enabled: false,
    subtasks: [
      { id: "plan", title: "사업 운영 계획 수립", offsetDays: -21, attachments: ["운영 계획서", "예산 집행 계획"] },
      {
        id: "equipment",
        title: "기자재 구입 품의",
        offsetDays: -14,
        attachments: ["견적서 3부", "규격서"],
        caution: "목적 사업비는 사용 항목이 정해져 있다. 집행 전에 지침을 확인한다.",
      },
      { id: "training", title: "교원 연수 실시", offsetDays: 0 },
      { id: "report", title: "중간 실적 보고", offsetDays: 60 },
    ],
  },
  {
    id: "edu-welfare",
    title: "교육복지우선지원사업",
    category: "grant",
    dept: "생활",
    anchor: { mode: "week", month: 3, week: 3 },
    enabled: false,
    subtasks: [
      { id: "plan", title: "사업 운영 계획 수립", offsetDays: -21 },
      {
        id: "select",
        title: "지원 대상 선정 협의",
        offsetDays: -14,
        caution: "대상 학생 정보는 이 앱에 적지 않는다. 별도 절차로 관리한다.",
      },
      { id: "run", title: "프로그램 운영 개시", offsetDays: 0 },
      { id: "report", title: "운영 실적 보고", offsetDays: 60 },
    ],
  },
];

// 4. 학교 자율 · 특색 사업 — 비어 있는 것이 맞다. 사용자가 직접 추가한다.

export const SEED_TASKS: Task[] = [...LEGAL, ...ANNUAL, ...GRANT];
