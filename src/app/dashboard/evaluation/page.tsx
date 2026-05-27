'use client'

import { useState, useEffect } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  ChevronRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

// ── 색상 팔레트 ──────────────────────────────────────────────────
const C = {
  blue:   '#3b82f6',
  green:  '#22c55e',
  red:    '#ef4444',
  yellow: '#f59e0b',
  purple: '#a855f7',
  orange: '#f97316',
} as const

// ── 목 데이터 ────────────────────────────────────────────────────

type ActiveStatus = 'active' | 'inactive'
type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected'
type DeployStatus = 'deployed' | 'ready' | 'blocked' | '-'
type PassFail = 'Pass' | 'Fail'

interface Dataset {
  id: string
  name: string
  version: string
  questionCount: number
  categories: { name: string; count: number }[]
  createdAt: string
  lastUsedAt: string
  status: ActiveStatus
}

interface SampleQuestion {
  id: number
  question: string
  answer: string
  category: string
}

interface DatasetUsageHistory {
  rcId: string
  rcVersion: string
  evaluatedAt: string
  ragasScore: number
  passRate: number
  gate: PassFail
}

interface CriteriaMetric {
  key: string
  label: string
  threshold: number
  unit: string
}

interface RCItem {
  id: string
  version: string
  pipeline: string
  ragasScore: number
  faithfulness: number
  answerRelevancy: number
  contextPrecision: number
  contextRecall: number
  passRate: number
  latencyMs: number
  gate: PassFail
  approvalStatus: ApprovalStatus
  approvedBy?: string
  approvedAt?: string
  deployStatus: DeployStatus
}

interface CriteriaRow {
  key: string
  label: string
  threshold: number
  actual: number
  unit: string
}

const mockDatasets: Dataset[] = [
  {
    id: 'ds-001',
    name: '세무·법률 QA 셋',
    version: 'v1.0',
    questionCount: 20,
    categories: [
      { name: '법률/규정', count: 10 },
      { name: '내부정책',  count: 5  },
      { name: '계약/서류', count: 5  },
    ],
    createdAt: '2026-05-27',
    lastUsedAt: '2026-05-27',
    status: 'active',
  },
]

const mockSampleQuestions: Record<string, SampleQuestion[]> = {
  'ds-001': [
    { id: 1,  question: '법인세법상 각 사업연도 소득에 대한 법인세 세율은?',          answer: '과세표준 2억 이하 9%, 2억 초과~200억 이하 19%, 200억 초과~3000억 이하 21%, 3000억 초과 24%입니다.', category: '법률/규정' },
    { id: 2,  question: '부가가치세 일반과세자의 신고·납부 기한은?',                  answer: '1기(1~6월) 확정신고는 7월 25일, 2기(7~12월) 확정신고는 다음 해 1월 25일까지입니다.',               category: '법률/규정' },
    { id: 3,  question: '소득세법상 근로소득 원천징수 시기는?',                       answer: '근로소득을 지급하는 달의 다음 달 10일까지 원천징수한 세액을 납부해야 합니다.',                      category: '법률/규정' },
    { id: 4,  question: '세금계산서 수취 후 매입세액 공제 신청 기한은?',              answer: '해당 과세기간의 확정신고 기한 내에 신청해야 하며, 기한 후 신고 시 공제가 제한될 수 있습니다.',      category: '내부정책' },
    { id: 5,  question: '법인카드 사용 후 증빙 제출 기한은?',                         answer: '사용일로부터 5영업일 이내에 경비 처리 시스템에 영수증을 등록해야 합니다.',                          category: '내부정책' },
    { id: 6,  question: '용역 계약서상 세금계산서 발급 조건은?',                      answer: '용역 공급 시기(계약서상 대금 지급일 또는 용역 완료일) 기준으로 발급하며, 선금 수령 시 수령일 기준으로 발급합니다.', category: '계약/서류' },
    { id: 7,  question: '원천징수 이행상황신고서 제출 시 첨부서류는?',                answer: '원천징수 이행상황신고서 본지와 원천징수세액 납부서를 함께 제출하며, 전자신고 시 별도 첨부 불필요합니다.', category: '계약/서류' },
    { id: 8,  question: '수정세금계산서를 발급할 수 있는 사유는?',                    answer: '착오 기재, 공급가액 변동, 계약 해제, 환입 등의 사유 발생 시 수정세금계산서를 발급할 수 있습니다.',  category: '법률/규정' },
    { id: 9,  question: '전자세금계산서 발급 의무 대상과 기한은?',                    answer: '법인사업자 및 직전연도 공급가액 8천만원 이상 개인사업자는 공급 시기 다음 날까지 발급해야 합니다.',  category: '법률/규정' },
    { id: 10, question: '외화 용역 계약 시 세금계산서 공급가액 산정 기준은?',         answer: '공급 시기의 기준환율 또는 재정환율을 적용하여 원화로 환산한 금액을 공급가액으로 기재합니다.',        category: '계약/서류' },
  ],
}

const mockUsageHistory: Record<string, DatasetUsageHistory[]> = {
  'ds-001': [
    { rcId: 'eval-v2.4.0-rc5-v1.0', rcVersion: 'v2.4.0-rc5', evaluatedAt: '2026-05-27 17:20', ragasScore: 0.9242, passRate: 92.4, gate: 'Pass' },
    { rcId: 'eval-v2.4.0-rc4-v1.0', rcVersion: 'v2.4.0-rc4', evaluatedAt: '2026-05-27 17:44', ragasScore: 0.9662, passRate: 89.3, gate: 'Fail' },
    { rcId: 'eval-v2.4.0-rc3-v1.0', rcVersion: 'v2.4.0-rc3', evaluatedAt: '2026-05-27 17:41', ragasScore: 0.8418, passRate: 87.3, gate: 'Fail' },
  ],
}

const defaultCriteria: CriteriaMetric[] = [
  { key: 'ragasScore',        label: 'RAGAS 종합 점수',   threshold: 0.80, unit: '' },
  { key: 'faithfulness',      label: 'Faithfulness',        threshold: 0.85, unit: '' },
  { key: 'answerRelevancy',   label: 'Answer Relevancy',    threshold: 0.75, unit: '' },
  { key: 'contextPrecision',  label: 'Context Precision',   threshold: 0.65, unit: '' },
  { key: 'contextRecall',     label: 'Context Recall',      threshold: 0.65, unit: '' },
  { key: 'passRate',          label: '체감 응답 통과율',   threshold: 82,   unit: '%' },
  { key: 'latencyMs',         label: '응답 속도 (Latency)', threshold: 2200, unit: 'ms' },
]

const mockRCList: RCItem[] = [
  {
    id: 'rc-2026-0523-01',
    version: 'v2.3.1',
    pipeline: 'rag-pipeline-prod',
    ragasScore: 0.873,
    faithfulness: 0.901,
    answerRelevancy: 0.856,
    contextPrecision: 0.812,
    contextRecall: 0.789,
    passRate: 91.2,
    latencyMs: 1340,
    gate: 'Pass',
    approvalStatus: 'Approved',
    approvedBy: '이승연',
    approvedAt: '2026-05-24 14:32',
    deployStatus: 'deployed',
  },
  {
    id: 'rc-2026-0521-01',
    version: 'v2.3.0',
    pipeline: 'rag-pipeline-prod',
    ragasScore: 0.791,
    faithfulness: 0.812,
    answerRelevancy: 0.803,
    contextPrecision: 0.754,
    contextRecall: 0.741,
    passRate: 83.7,
    latencyMs: 1820,
    gate: 'Fail',
    approvalStatus: 'Rejected',
    approvedBy: '이승연',
    approvedAt: '2026-05-22 09:15',
    deployStatus: 'blocked',
  },
  {
    id: 'rc-2026-0526-01',
    version: 'v2.4.0-rc1',
    pipeline: 'rag-pipeline-staging',
    ragasScore: 0.841,
    faithfulness: 0.868,
    answerRelevancy: 0.847,
    contextPrecision: 0.803,
    contextRecall: 0.776,
    passRate: 88.4,
    latencyMs: 1560,
    gate: 'Pass',
    approvalStatus: 'Pending',
    deployStatus: 'ready',
  },
]

// ── 공통 컴포넌트 ─────────────────────────────────────────────────

function ActiveBadge({ status }: { status: ActiveStatus }) {
  const isActive = status === 'active'
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{
        color: isActive ? C.green : 'hsl(var(--muted-foreground))',
        backgroundColor: isActive ? 'rgba(34,197,94,0.1)' : 'hsl(var(--muted))',
      }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isActive ? C.green : 'hsl(var(--muted-foreground))' }} />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}

function GateBadge({ gate }: { gate: PassFail }) {
  return gate === 'Pass' ? (
    <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: C.green }}>
      <ShieldCheck className="h-3 w-3" /> Pass
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: C.red }}>
      <ShieldAlert className="h-3 w-3" /> Fail
    </span>
  )
}

function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const cfg: Record<ApprovalStatus, { color: string; bg: string }> = {
    Approved: { color: C.green,  bg: 'rgba(34,197,94,0.1)'  },
    Rejected: { color: C.red,    bg: 'rgba(239,68,68,0.1)'  },
    Pending:  { color: C.yellow, bg: 'rgba(245,158,11,0.1)' },
  }
  const { color, bg } = cfg[status]
  return (
    <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ color, backgroundColor: bg }}>
      {status}
    </span>
  )
}

function DeployBadge({ status }: { status: DeployStatus }) {
  const cfg: Record<DeployStatus, { color: string; bg: string; label: string }> = {
    deployed: { color: C.green,  bg: 'rgba(34,197,94,0.1)',   label: 'Deployed'  },
    ready:    { color: C.blue,   bg: 'rgba(59,130,246,0.1)',  label: 'Ready'     },
    blocked:  { color: C.red,    bg: 'rgba(239,68,68,0.1)',   label: 'Blocked'   },
    '-':      { color: 'hsl(var(--muted-foreground))', bg: 'hsl(var(--muted))', label: '-' },
  }
  const { color, bg, label } = cfg[status]
  return (
    <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ color, backgroundColor: bg }}>
      {label}
    </span>
  )
}

function RowPassFail({ pass }: { pass: boolean }) {
  return pass ? (
    <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: C.green }}>
      <CheckCircle2 className="h-3 w-3" /> Pass
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: C.red }}>
      <XCircle className="h-3 w-3" /> Fail
    </span>
  )
}

// ── 탭 1: 테스트 데이터셋 ─────────────────────────────────────────

function DatasetDetailSheet({ dataset, open, onClose }: {
  dataset: Dataset | null
  open: boolean
  onClose: () => void
}) {
  if (!dataset) return null

  const samples = mockSampleQuestions[dataset.id] ?? []
  const history = mockUsageHistory[dataset.id] ?? []
  const total = dataset.questionCount

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-[560px] max-w-full overflow-y-auto px-6 sm:max-w-[560px]">
        <SheetHeader className="mb-5">
          <SheetTitle className="flex items-center gap-2 text-base">
            {dataset.name}
            <span className="font-mono text-sm font-normal text-muted-foreground">{dataset.version}</span>
            <ActiveBadge status={dataset.status} />
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            질문 {dataset.questionCount.toLocaleString()}개 · 생성일 {dataset.createdAt} · 마지막 사용 {dataset.lastUsedAt}
          </p>
        </SheetHeader>

        <div className="space-y-6">
          {/* 카테고리 분포 */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              카테고리 분포
            </p>
            <div className="space-y-2.5">
              {dataset.categories.map(cat => {
                const pct = Math.round((cat.count / total) * 100)
                return (
                  <div key={cat.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{cat.name}</span>
                      <span className="text-muted-foreground">{cat.count}개 ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: C.blue }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 질문 샘플 미리보기 */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              질문 샘플 미리보기 ({samples.length}건)
            </p>
            <div className="space-y-3">
              {samples.map(s => (
                <div key={s.id} className="rounded-lg border p-3 text-xs">
                  <div className="mb-1.5 flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {s.category}
                    </span>
                    <p className="font-medium leading-relaxed">{s.question}</p>
                  </div>
                  <p className="leading-relaxed text-muted-foreground pl-1 border-l-2 border-border ml-1">
                    {s.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 사용 이력 */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              사용 이력
            </p>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">사용 이력이 없습니다.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {['RC 버전', '평가일시', 'RAGAS', '통과율', 'Gate'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.rcId} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 font-mono font-medium">{h.rcVersion}</td>
                        <td className="px-3 py-2 text-muted-foreground">{h.evaluatedAt}</td>
                        <td className="px-3 py-2 font-mono font-semibold" style={{ color: h.ragasScore >= 0.80 ? C.green : C.red }}>
                          {h.ragasScore.toFixed(3)}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold" style={{ color: h.passRate >= 85 ? C.green : C.red }}>
                          {h.passRate}%
                        </td>
                        <td className="px-3 py-2">
                          <GateBadge gate={h.gate} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DatasetTab() {
  const [selectedDs, setSelectedDs] = useState<Dataset | null>(null)

  return (
    <div className="space-y-4">
      <DatasetDetailSheet
        dataset={selectedDs}
        open={selectedDs !== null}
        onClose={() => setSelectedDs(null)}
      />
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  {['이름 / 버전', '질문 수', '카테고리 구성', '생성일', '마지막 사용일', '상태', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockDatasets.map(ds => (
                  <tr
                    key={ds.id}
                    className="border-b cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => setSelectedDs(ds)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{ds.name}</p>
                      <p className="text-muted-foreground font-mono">{ds.version}</p>
                    </td>
                    <td className="px-4 py-3 font-bold" style={{ color: C.blue }}>
                      {ds.questionCount.toLocaleString()}개
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {ds.categories.map(cat => (
                          <span key={cat.name} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                            {cat.name} <span className="font-semibold">{cat.count}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{ds.createdAt}</td>
                    <td className="px-4 py-3 text-muted-foreground">{ds.lastUsedAt}</td>
                    <td className="px-4 py-3">
                      <ActiveBadge status={ds.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── 탭 2: 합격 기준 설정 ─────────────────────────────────────────

function CriteriaTab() {
  const [criteria, setCriteria] = useState<CriteriaMetric[]>(defaultCriteria)
  const [saved, setSaved] = useState(false)

  function handleChange(key: string, value: string) {
    setCriteria(prev =>
      prev.map(c => (c.key === key ? { ...c, threshold: Number(value) } : c))
    )
    setSaved(false)
  }

  function handleSave() {
    setSaved(true)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">합격 기준 임계값</CardTitle>
            <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              {saved ? '저장됨' : '저장'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {['지표', '임계값', '단위'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criteria.map(c => (
                <tr key={c.key} className="border-b transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{c.label}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      step={c.unit === '%' || c.unit === 'ms' ? 1 : 0.01}
                      min={0}
                      value={c.threshold}
                      onChange={e => handleChange(c.key, e.target.value)}
                      className="w-28 rounded border bg-background px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.unit || '0 ~ 1 범위'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

// ── KFP 데이터 타입 ──────────────────────────────────────────────

interface KFPRun {
  runId: string
  displayName: string
  rcVersion: string
  datasetName: string
  datasetVersion: string
  questionCount: number
  status: string
  createdAt: string
  finishedAt: string
  metrics: Record<string, number> | null
}

interface ApprovalState {
  status: ApprovalStatus
  approvedBy?: string
  approvedAt?: string
}

// ── 탭 3: RC 목록 ────────────────────────────────────────────────

function RCListTab({ runs, loading, approvalStates }: {
  runs: KFPRun[]
  loading: boolean
  approvalStates: Record<string, ApprovalState>
}) {
  function gateFromMetrics(metrics: Record<string, number> | null): PassFail | null {
    if (!metrics) return null
    return (
      metrics.ragas_score       >= 0.80 &&
      metrics.faithfulness      >= 0.85 &&
      metrics.answer_relevancy  >= 0.75 &&
      metrics.context_precision >= 0.65 &&
      metrics.context_recall    >= 0.65 &&
      metrics.pass_rate         >= 82.0 &&
      metrics.latency_ms        <= 2200
    ) ? 'Pass' : 'Fail'
  }

  function deployStatus(runId: string, gate: PassFail | null): DeployStatus {
    const approval = approvalStates[runId]?.status ?? 'Pending'
    if (approval === 'Approved') return 'deployed'
    if (approval === 'Rejected') return 'blocked'
    if (gate === 'Pass') return 'ready'
    return 'blocked'
  }

  function fmtDate(iso: string) {
    if (!iso) return '-'
    return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        RC (Release Candidate) — 운영 배포 전 검토 대상 후보 버전. RAGAS 평가를 통과한 RC만 승인 후 배포됩니다.
      </p>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              KFP에서 데이터를 불러오는 중...
            </div>
          ) : runs.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              평가 실행 이력이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {['버전 / 데이터셋', 'RAGAS 지표', 'Gate', '승인 상태', '승인자 / 일시', '배포 상태'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.map(run => {
                    const gate = gateFromMetrics(run.metrics)
                    const approval = approvalStates[run.runId] ?? { status: 'Pending' }
                    return (
                      <tr key={run.runId} className="border-b transition-colors hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <p className="font-semibold font-mono">{run.rcVersion}</p>
                          <p className="text-muted-foreground">{run.datasetName} {run.datasetVersion}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(run.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3">
                          {run.metrics ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground w-20">RAGAS</span>
                                <span className="font-bold font-mono" style={{ color: (run.metrics.ragas_score ?? 0) >= 0.80 ? C.green : C.red }}>
                                  {(run.metrics.ragas_score ?? 0).toFixed(3)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground w-20">통과율</span>
                                <span className="font-bold font-mono" style={{ color: (run.metrics.pass_rate ?? 0) >= 85 ? C.green : C.red }}>
                                  {run.metrics.pass_rate ?? '-'}%
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground w-20">Latency</span>
                                <span className="font-mono" style={{ color: (run.metrics.latency_ms ?? 9999) <= 2000 ? C.green : C.red }}>
                                  {(run.metrics.latency_ms ?? 0).toLocaleString()}ms
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">
                              {run.status === 'SUCCEEDED' ? '지표 없음' : run.status}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {gate ? <GateBadge gate={gate} /> : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="px-4 py-3">
                          <ApprovalBadge status={approval.status} />
                        </td>
                        <td className="px-4 py-3">
                          {approval.approvedBy ? (
                            <>
                              <p className="font-medium">{approval.approvedBy}</p>
                              <p className="text-muted-foreground">{approval.approvedAt}</p>
                            </>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <DeployBadge status={deployStatus(run.runId, gate)} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── 탭 4: 승인 제어판 ────────────────────────────────────────────

function ApprovalTab({ runs, loading, approvalStates, onApprove, onReject }: {
  runs: KFPRun[]
  loading: boolean
  approvalStates: Record<string, ApprovalState>
  onApprove: (runId: string) => void
  onReject: (runId: string) => void
}) {
  const succeededRuns = runs.filter(r => r.status === 'SUCCEEDED' && r.metrics)
  const [selectedId, setSelectedId] = useState<string>('')

  useEffect(() => {
    if (succeededRuns.length > 0 && !selectedId) {
      setSelectedId(succeededRuns[0].runId)
    }
  }, [succeededRuns, selectedId])

  const selected = succeededRuns.find(r => r.runId === selectedId)
  const currentApproval = approvalStates[selectedId] ?? { status: 'Pending' }

  const isLatency = (key: string) => key === 'latency_ms'

  const criteriaRows = selected?.metrics ? [
    { key: 'ragas_score',       label: 'RAGAS 종합 점수',   threshold: 0.80,  actual: selected.metrics.ragas_score ?? 0,       unit: '' },
    { key: 'faithfulness',      label: 'Faithfulness',        threshold: 0.85,  actual: selected.metrics.faithfulness ?? 0,      unit: '' },
    { key: 'answer_relevancy',  label: 'Answer Relevancy',    threshold: 0.75,  actual: selected.metrics.answer_relevancy ?? 0,  unit: '' },
    { key: 'context_precision', label: 'Context Precision',   threshold: 0.65,  actual: selected.metrics.context_precision ?? 0, unit: '' },
    { key: 'context_recall',    label: 'Context Recall',      threshold: 0.65,  actual: selected.metrics.context_recall ?? 0,    unit: '' },
    { key: 'pass_rate',         label: '체감 응답 통과율',   threshold: 82,    actual: selected.metrics.pass_rate ?? 0,         unit: '%' },
    { key: 'latency_ms',        label: '응답 속도 (Latency)', threshold: 2200,  actual: selected.metrics.latency_ms ?? 0,        unit: 'ms' },
  ] : []

  function isPassing(row: CriteriaRow) {
    return isLatency(row.key) ? row.actual <= row.threshold : row.actual >= row.threshold
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      KFP에서 데이터를 불러오는 중...
    </div>
  )

  if (succeededRuns.length === 0) return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      완료된 평가 실행이 없습니다.
    </div>
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <span className="text-sm font-medium text-muted-foreground shrink-0">RC 선택</span>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="h-8 w-[320px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {succeededRuns.map(run => (
                <SelectItem key={run.runId} value={run.runId} className="text-xs">
                  <span className="flex items-center gap-2">
                    <span className="font-mono">{run.rcVersion}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{run.datasetName}</span>
                    <ApprovalBadge status={approvalStates[run.runId]?.status ?? 'Pending'} />
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected && (
            <div className="flex items-center gap-2 ml-auto">
              <GateBadge gate={
                selected.metrics && (
                  selected.metrics.ragas_score       >= 0.80 &&
                  selected.metrics.faithfulness      >= 0.85 &&
                  selected.metrics.answer_relevancy  >= 0.75 &&
                  selected.metrics.context_precision >= 0.65 &&
                  selected.metrics.context_recall    >= 0.65 &&
                  selected.metrics.pass_rate         >= 82.0 &&
                  selected.metrics.latency_ms        <= 2200
                ) ? 'Pass' : 'Fail'
              } />
              <ApprovalBadge status={currentApproval.status} />
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">
                기준치 vs 실제 점수 — {selected.rcVersion}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {['지표', '기준치', '실제값', '결과'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {criteriaRows.map(row => {
                    const pass = isPassing(row)
                    const fmt = (v: number) =>
                      row.unit === 'ms' ? `${v.toLocaleString()}ms`
                      : row.unit === '%' ? `${v}%`
                      : v.toFixed(3)
                    return (
                      <tr key={row.key} className="border-b transition-colors hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium">{row.label}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {isLatency(row.key) ? `≤ ${fmt(row.threshold)}` : `≥ ${fmt(row.threshold)}`}
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold" style={{ color: pass ? C.green : C.red }}>
                          {fmt(row.actual)}
                        </td>
                        <td className="px-4 py-3">
                          <RowPassFail pass={pass} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            {currentApproval.status === 'Pending' ? (
              <>
                <Button size="sm" className="gap-2" style={{ backgroundColor: C.green, color: '#fff' }}
                  onClick={() => onApprove(selectedId)}>
                  <CheckCircle2 className="h-4 w-4" /> 승인
                </Button>
                <Button size="sm" variant="destructive" className="gap-2"
                  onClick={() => onReject(selectedId)}>
                  <XCircle className="h-4 w-4" /> 반려
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                이미 처리된 RC입니다 ({currentApproval.status})
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────

export default function QualityGatePage() {
  const [kfpRuns, setKfpRuns] = useState<KFPRun[]>([])
  const [loading, setLoading] = useState(true)
  const [approvalStates, setApprovalStates] = useState<Record<string, ApprovalState>>({})

  useEffect(() => {
    fetch('/api/kfp/runs')
      .then(r => r.json())
      .then(data => {
        setKfpRuns(data.runs ?? [])
        const initial: Record<string, ApprovalState> = {}
        for (const run of data.runs ?? []) {
          initial[run.runId] = { status: 'Pending' }
        }
        setApprovalStates(initial)
      })
      .finally(() => setLoading(false))
  }, [])

  function handleApprove(runId: string) {
    setApprovalStates(prev => ({
      ...prev,
      [runId]: { status: 'Approved', approvedBy: '이승연', approvedAt: new Date().toLocaleString('ko-KR') },
    }))
  }

  function handleReject(runId: string) {
    setApprovalStates(prev => ({
      ...prev,
      [runId]: { status: 'Rejected', approvedBy: '이승연', approvedAt: new Date().toLocaleString('ko-KR') },
    }))
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5" style={{ color: C.blue }} />
        <div>
          <h1 className="text-lg font-bold">퀄리티 게이트</h1>
          <p className="text-xs text-muted-foreground">
            RC 합격 기준 통과 여부 확인 및 운영 클러스터 배포 승인 관리
          </p>
        </div>
      </div>

      <Tabs defaultValue="dataset">
        <TabsList>
          <TabsTrigger value="dataset">테스트 데이터셋</TabsTrigger>
          <TabsTrigger value="criteria">합격 기준 설정</TabsTrigger>
          <TabsTrigger value="rc-list">RC 목록</TabsTrigger>
          <TabsTrigger value="approval">승인 제어판</TabsTrigger>
        </TabsList>

        <TabsContent value="dataset" className="mt-5">
          <DatasetTab />
        </TabsContent>
        <TabsContent value="criteria" className="mt-5">
          <CriteriaTab />
        </TabsContent>
        <TabsContent value="rc-list" className="mt-5">
          <RCListTab runs={kfpRuns} loading={loading} approvalStates={approvalStates} />
        </TabsContent>
        <TabsContent value="approval" className="mt-5">
          <ApprovalTab
            runs={kfpRuns}
            loading={loading}
            approvalStates={approvalStates}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
