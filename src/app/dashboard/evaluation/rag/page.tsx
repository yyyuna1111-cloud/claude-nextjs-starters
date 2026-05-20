'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  PieChart,
  Pie,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CheckCircle2,
  Clock,
  DollarSign,
  FlaskConical,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import {
  evalPipelineRuns,
  evalVersionComparison,
  ragClusterPoints,
  ragDailyTrend,
  ragFlowData,
  ragHeatmapData,
  ragRadarMetrics,
  type EvalGateResult,
  type EvalPipelineStatus,
  type HeatmapCell,
} from '@/lib/eval-mock-data'

const C = {
  blue:   '#3b82f6',
  green:  '#22c55e',
  red:    '#ef4444',
  yellow: '#f59e0b',
  purple: '#a855f7',
  orange: '#f97316',
} as const

const CHART_GRID = 'hsl(var(--border))'
const CHART_TICK = 'hsl(var(--muted-foreground))'
const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  color: 'hsl(var(--card-foreground))',
  fontSize: 12,
}

function heatCell(rate: number) {
  if (rate >= 90) return { bg: 'rgba(34,197,94,0.2)',   text: '#16a34a' }
  if (rate >= 80) return { bg: 'rgba(34,197,94,0.1)',   text: '#22c55e' }
  if (rate >= 70) return { bg: 'rgba(245,158,11,0.15)', text: '#d97706' }
  if (rate >= 60) return { bg: 'rgba(249,115,22,0.15)', text: '#ea580c' }
  return           { bg: 'rgba(239,68,68,0.15)',  text: '#dc2626' }
}

function fmtSec(s: number) {
  if (!s) return '-'
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function relTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 1)    return '방금'
  if (diff < 60)   return `${diff}분 전`
  if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`
  return `${Math.floor(diff / 1440)}일 전`
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  )
}

function StatusBadge({ status }: { status: EvalPipelineStatus }) {
  const cfg: Record<EvalPipelineStatus, { label: string; color: string; bg: string }> = {
    success: { label: '완료',    color: C.green,  bg: 'rgba(34,197,94,0.1)'  },
    failed:  { label: '실패',    color: C.red,    bg: 'rgba(239,68,68,0.1)'  },
    running: { label: '실행 중', color: C.blue,   bg: 'rgba(59,130,246,0.1)' },
    pending: { label: '대기',    color: 'hsl(var(--muted-foreground))', bg: 'hsl(var(--muted))' },
  }
  const { label, color, bg } = cfg[status]
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ color, backgroundColor: bg }}
    >
      {status === 'running' && <RefreshCw className="h-2.5 w-2.5 animate-spin" />}
      {label}
    </span>
  )
}

function GateBadge({ result }: { result: EvalGateResult }) {
  if (result === 'passed') return (
    <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: C.green }}>
      <ShieldCheck className="h-3 w-3" /> 통과
    </span>
  )
  if (result === 'blocked') return (
    <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: C.red }}>
      <ShieldAlert className="h-3 w-3" /> 차단
    </span>
  )
  if (result === 'running') return (
    <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: C.yellow }}>
      <Loader2 className="h-3 w-3 animate-spin" /> 평가 중
    </span>
  )
  return <span className="text-[11px] text-muted-foreground">-</span>
}

function StepDot({ status }: { status: EvalPipelineStatus }) {
  if (status === 'success') return <CheckCircle2 className="h-3.5 w-3.5" style={{ color: C.green }} />
  if (status === 'failed')  return <XCircle       className="h-3.5 w-3.5" style={{ color: C.red }} />
  if (status === 'running') return <Loader2        className="h-3.5 w-3.5 animate-spin" style={{ color: C.blue }} />
  return <span className="inline-block h-3.5 w-3.5 rounded-full border border-border" />
}

export default function RagEvalPage() {
  const latest          = evalPipelineRuns[0]
  const latestCompleted = evalPipelineRuns.find(r => r.status === 'success')

  const donutData = [
    { name: '통과', value: latestCompleted?.passRate ?? 0 },
    { name: '실패', value: 100 - (latestCompleted?.passRate ?? 0) },
  ]

  const successPts  = ragClusterPoints.filter(p => p.cluster === 'success')
  const retFailPts  = ragClusterPoints.filter(p => p.cluster === 'retrieval-fail')
  const genFailPts  = ragClusterPoints.filter(p => p.cluster === 'generation-fail')
  const bothFailPts = ragClusterPoints.filter(p => p.cluster === 'both-fail')

  const HOURS = ['00:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00']
  const CATS  = ['법률/규정', '기술문서', '내부정책', '제품/서비스']
  const heatMap = new Map<string, HeatmapCell>()
  ragHeatmapData.forEach(d => heatMap.set(`${d.hour}|${d.category}`, d))

  return (
    <div className="space-y-5 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" style={{ color: C.purple }} />
            <h1 className="text-lg font-bold">RAG 평가 분석 대시보드</h1>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Argo CD · MLflow · Prometheus 연동 · 30s 자동 갱신
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['v2.3.1 활성', 'rag-testset-v3.2'].map(tag => (
            <span key={tag} className="rounded border px-2 py-1 text-xs text-muted-foreground">{tag}</span>
          ))}
          <button className="flex items-center gap-1 rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
            <RefreshCw className="h-3 w-3" /> 새로고침
          </button>
        </div>
      </div>

      {/* 실행 중 배너 */}
      {latest.status === 'running' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: C.blue }} />
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                평가 실행 중 · {latest.id}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {latest.modelVersion} · {latest.datasetVersion} ({latest.datasetSize}개 케이스)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {latest.steps.map((step, i) => (
              <div key={step.name} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <StepDot status={step.status} />
                  <div>
                    <p className="text-xs font-medium" style={{
                      color: step.status === 'running' ? C.blue
                           : step.status === 'success' ? C.green
                           : 'hsl(var(--muted-foreground))',
                    }}>
                      {step.name}
                    </p>
                    {step.durationSec > 0 && (
                      <p className="text-[10px] text-muted-foreground">{fmtSec(step.durationSec)}</p>
                    )}
                  </div>
                </div>
                {i < latest.steps.length - 1 && (
                  <div className="h-px w-8 rounded bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div style={{ width: 68, height: 68, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%" cy="50%"
                    innerRadius={24} outerRadius={32}
                    dataKey="value"
                    strokeWidth={0}
                    startAngle={90} endAngle={-270}
                  >
                    <Cell fill={C.green} />
                    <Cell fill="hsl(var(--muted))" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">최신 통과율</p>
              <p className="text-2xl font-bold" style={{ color: C.green }}>
                {latestCompleted?.passRate}%
              </p>
              <p className="flex items-center gap-0.5 text-[11px]" style={{ color: C.green }}>
                <TrendingUp className="h-3 w-3" /> +3.7% vs 이전
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">RAGAS Score</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: C.blue }}>0.864</p>
            <p className="flex items-center gap-0.5 text-[11px]" style={{ color: C.blue }}>
              <TrendingUp className="h-3 w-3" /> +0.021 vs v2.2.0
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-xs text-muted-foreground">평균 소요시간</p>
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-1 text-2xl font-bold">5m 12s</p>
            <p className="flex items-center gap-0.5 text-[11px]" style={{ color: C.green }}>
              <TrendingDown className="h-3 w-3" /> -12s 개선
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-xs text-muted-foreground">오늘 추정 비용</p>
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-1 text-2xl font-bold">$3.24</p>
            <p className="flex items-center gap-0.5 text-[11px]" style={{ color: C.orange }}>
              <TrendingUp className="h-3 w-3" /> +8.7% vs 어제
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 실행 이력 + 버전 비교 레이더 */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 overflow-hidden p-0">
          <div className="border-b px-4 py-3">
            <SectionLabel>평가 파이프라인 실행 이력</SectionLabel>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  {['실행 ID', '모델 버전', '데이터셋', '트리거', '통과율', 'Gate', '상태', '소요', '시작'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evalPipelineRuns.map(run => (
                  <tr key={run.id} className="border-b transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono">
                      <Link href={`/dashboard/evaluation/rag/${run.id}`} className="text-primary hover:underline">
                        {run.id}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{run.modelVersion}</td>
                    <td className="px-4 py-2.5">
                      <div>{run.datasetVersion}</div>
                      <div className="text-muted-foreground">{run.datasetSize}개</div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{run.trigger}</td>
                    <td className="px-4 py-2.5">
                      {run.passRate > 0 ? (
                        <span className="font-bold" style={{ color: run.passRate >= 85 ? C.green : C.red }}>
                          {run.passRate}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5"><GateBadge result={run.gateResult} /></td>
                    <td className="px-4 py-2.5"><StatusBadge status={run.status} /></td>
                    <td className="px-4 py-2.5 font-mono text-muted-foreground">{fmtSec(run.durationSec)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{relTime(run.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardContent className="p-4">
            <SectionLabel>버전 비교 레이더 · v2.3.1 vs v2.2.0</SectionLabel>
            <ResponsiveContainer width="100%" height={210}>
              <RadarChart data={ragRadarMetrics} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                <PolarGrid stroke={CHART_GRID} />
                <PolarAngleAxis dataKey="metric" tick={{ fill: CHART_TICK, fontSize: 10 }} />
                <Radar name="v2.3.1" dataKey="current"  stroke={C.blue}   fill={C.blue}   fillOpacity={0.2}  strokeWidth={2} />
                <Radar name="v2.2.0" dataKey="previous" stroke={C.purple} fill={C.purple} fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="4 4" />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-2 border-t pt-3">
              {evalVersionComparison.map(row => {
                const delta = ((row.current - row.previous) / row.previous * 100).toFixed(1)
                const up = row.current > row.previous
                const aboveThreshold = row.current >= row.threshold
                return (
                  <div key={row.metric} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{row.metric}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold" style={{ color: aboveThreshold ? C.green : C.red }}>
                        {row.current < 1 ? row.current.toFixed(3) : `${row.current}%`}
                      </span>
                      <span className="font-mono text-[10px]" style={{ color: up ? C.green : C.red }}>
                        {up ? '+' : ''}{delta}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 분석 차트 3종 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <SectionLabel>일별 성능 트렌드 (5일)</SectionLabel>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={ragDailyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fill: CHART_TICK, fontSize: 10 }} />
                <YAxis domain={[65, 100]} tick={{ fill: CHART_TICK, fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="passRate"     stroke={C.green}  strokeWidth={2} dot={{ r: 3, fill: C.green }}  name="통과율" />
                <Line type="monotone" dataKey="faithfulness" stroke={C.blue}   strokeWidth={2} dot={{ r: 3, fill: C.blue }}   name="Faithfulness" />
                <Line type="monotone" dataKey="ragasScore"   stroke={C.purple} strokeWidth={2} dot={{ r: 3, fill: C.purple }} name="RAGAS" strokeDasharray="5 5" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <SectionLabel>실패 원인 클러스터 분석</SectionLabel>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart margin={{ top: 5, right: 5, left: -20, bottom: 15 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
                <XAxis
                  dataKey="x" type="number" domain={[0.2, 1]} name="Retrieval Score"
                  tick={{ fill: CHART_TICK, fontSize: 10 }}
                  label={{ value: 'Retrieval', fill: CHART_TICK, fontSize: 10, position: 'insideBottom', offset: -8 }}
                />
                <YAxis dataKey="y" type="number" domain={[0.3, 1]} name="Faithfulness" tick={{ fill: CHART_TICK, fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Scatter data={successPts}  fill={C.green}  opacity={0.85} name="통과"     r={4} />
                <Scatter data={retFailPts}  fill={C.orange} opacity={0.85} name="검색 실패" r={4} />
                <Scatter data={genFailPts}  fill={C.purple} opacity={0.85} name="생성 실패" r={4} />
                <Scatter data={bothFailPts} fill={C.red}    opacity={0.85} name="복합 실패" r={4} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <SectionLabel>카테고리별 통과 · 실패 분포</SectionLabel>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ragFlowData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: CHART_TICK, fontSize: 10 }} />
                <YAxis type="category" dataKey="category" tick={{ fill: CHART_TICK, fontSize: 10 }} width={70} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="통과" stackId="a" fill={C.green} fillOpacity={0.8} />
                <Bar dataKey="실패" stackId="a" fill={C.red}   fillOpacity={0.8} radius={[0, 3, 3, 0]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 시간대별 히트맵 */}
      <Card>
        <CardContent className="p-4">
          <SectionLabel>시간대별 쿼리 통과율 히트맵</SectionLabel>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="pb-2 pr-4 text-left font-medium text-muted-foreground" style={{ minWidth: 80 }}>
                    카테고리
                  </th>
                  {HOURS.map(h => (
                    <th key={h} className="pb-2 text-center font-medium text-muted-foreground" style={{ minWidth: 76 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATS.map(cat => (
                  <tr key={cat}>
                    <td className="py-1 pr-4 font-medium text-muted-foreground">{cat}</td>
                    {HOURS.map(h => {
                      const cell = heatMap.get(`${h}|${cat}`)
                      if (!cell) return (
                        <td key={h} className="px-1 py-1">
                          <div className="rounded bg-muted py-2 text-center">
                            <span className="text-muted-foreground">-</span>
                          </div>
                        </td>
                      )
                      const { bg, text } = heatCell(cell.passRate)
                      return (
                        <td key={h} className="px-1 py-1">
                          <div className="rounded py-1.5 text-center" style={{ backgroundColor: bg }}>
                            <div className="font-bold" style={{ color: text }}>{cell.passRate}%</div>
                            <div className="text-[10px] text-muted-foreground">{cell.count}건</div>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground">통과율:</span>
              {[
                { label: '≥90%', bg: 'rgba(34,197,94,0.2)',   text: '#16a34a' },
                { label: '≥80%', bg: 'rgba(34,197,94,0.1)',   text: '#22c55e' },
                { label: '≥70%', bg: 'rgba(245,158,11,0.15)', text: '#d97706' },
                { label: '≥60%', bg: 'rgba(249,115,22,0.15)', text: '#ea580c' },
                { label: '<60%', bg: 'rgba(239,68,68,0.15)',  text: '#dc2626' },
              ].map(({ label, bg, text }) => (
                <span key={label} className="flex items-center gap-1 text-[10px]">
                  <span className="inline-block h-3 w-5 rounded" style={{ backgroundColor: bg }} />
                  <span style={{ color: text }}>{label}</span>
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
