'use client'

import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
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
  Cpu,
  DollarSign,
  FlaskConical,
  GitBranch,
  History,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  evalPipelineRuns,
  evalVersionComparison,
  embeddingLatencyHistory,
  embeddingQualityTrend,
  embeddingVersionComparison,
  embeddingRolloutHistory,
  embeddingRpsHistory,
  inferenceServices,
  inferenceServicePodStatus,
  inferenceServiceQueueSize,
  inferenceService429Rate,
  inferenceQueueSizeHistory,
  inferenceQueueLatencyHistory,
  inferenceRpsHistory,
  inferenceHttpStatusRpsHistory,
  ragClusterPoints,
  ragFlowData,
  ragHeatmapData,
  ragRadarMetrics,
  ragVersions,
  ragVersionKpi,
  ragVersionRadar,
  ragVersionDailyTrend,
  type RagVersion,
  type EvalGateResult,
  type EvalPipelineStatus,
  type HeatmapCell,
  type Environment,
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
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ color, backgroundColor: bg }}>
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

function heatCell(rate: number) {
  if (rate >= 90) return { bg: 'rgba(34,197,94,0.2)',   text: '#16a34a' }
  if (rate >= 80) return { bg: 'rgba(34,197,94,0.1)',   text: '#22c55e' }
  if (rate >= 70) return { bg: 'rgba(245,158,11,0.15)', text: '#d97706' }
  if (rate >= 60) return { bg: 'rgba(249,115,22,0.15)', text: '#ea580c' }
  return           { bg: 'rgba(239,68,68,0.15)',  text: '#dc2626' }
}

function fmtVectors(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function EnvDot({ env }: { env: Environment }) {
  const color = { prod: C.green, staging: C.yellow, dev: C.blue }[env]
  return <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
}

function EnvBadge({ env }: { env: Environment }) {
  const cfg = {
    prod:    { color: C.green,  bg: 'rgba(34,197,94,0.1)'  },
    staging: { color: C.yellow, bg: 'rgba(245,158,11,0.1)' },
    dev:     { color: C.blue,   bg: 'rgba(59,130,246,0.1)' },
  }[env]
  return (
    <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}>
      {env}
    </span>
  )
}

// ────────────────────────────────────────────────────────────────
// 검색품질 탭
// ────────────────────────────────────────────────────────────────
function RetrievalTab({ version }: { version: RagVersion }) {
  const [selectedService, setSelectedService] = useState(inferenceServices[0])
  const podStatus = inferenceServicePodStatus[selectedService]
  const queueSize = inferenceServiceQueueSize[selectedService]
  const rate429   = inferenceService429Rate[selectedService]
  const kpi       = ragVersionKpi[version]

  const retFailPts  = ragClusterPoints.filter(p => p.cluster === 'retrieval-fail')
  const successPts  = ragClusterPoints.filter(p => p.cluster === 'success')
  const genFailPts  = ragClusterPoints.filter(p => p.cluster === 'generation-fail')
  const bothFailPts = ragClusterPoints.filter(p => p.cluster === 'both-fail')

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '총 인덱싱 벡터', value: '4.82M',                          sub: 'prod 기준',                                                   icon: <Cpu    className="h-4 w-4 text-muted-foreground" />, color: C.blue   },
          { label: '임베딩 처리량',  value: '2,450/s',                        sub: 'prod 실시간',                                                 icon: <Zap    className="h-4 w-4 text-muted-foreground" />, color: C.green  },
          { label: 'Context Recall', value: kpi.contextRecall.toFixed(3),     sub: `${version} 기준`,                                             icon: <Search className="h-4 w-4 text-muted-foreground" />, color: C.purple },
          { label: 'NDCG@10',       value: '0.847',                          sub: version === 'v2.3.1' ? '+0.009 vs 이전' : `${version} 기준`,    icon: <Clock  className="h-4 w-4 text-muted-foreground" />, color: C.orange },
        ].map(({ label, value, sub, icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <p className="text-xs text-muted-foreground">{label}</p>
                {icon}
              </div>
              <p className="mt-1 text-2xl font-bold" style={{ color }}>{value}</p>
              <p className="text-[11px] text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 검색 품질 트렌드 + 버전 비교 */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardContent className="p-4">
            <SectionLabel>검색 품질 주간 트렌드</SectionLabel>
            <ResponsiveContainer width="100%" height={190}>
              <ComposedChart data={embeddingQualityTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fill: CHART_TICK, fontSize: 10 }} />
                <YAxis domain={[0.75, 0.95]} tick={{ fill: CHART_TICK, fontSize: 10 }} tickFormatter={(v) => v.toFixed(2)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [Number(v).toFixed(3)]} />
                <Line type="monotone" dataKey="ndcg10"   stroke={C.blue}   strokeWidth={2} dot={{ r: 4, fill: C.blue }}   name="NDCG@10"   />
                <Line type="monotone" dataKey="mrr"      stroke={C.purple} strokeWidth={2} dot={{ r: 4, fill: C.purple }} name="MRR"       />
                <Line type="monotone" dataKey="recall10" stroke={C.green}  strokeWidth={2} dot={{ r: 4, fill: C.green }}  name="Recall@10" strokeDasharray="5 5" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                검색 품질 버전 비교
              </p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-3 rounded-sm" style={{ backgroundColor: C.blue }} />v1.5.0
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-3 rounded-sm opacity-40" style={{ backgroundColor: C.blue }} />v1.4.2
                </span>
              </div>
            </div>
            <div className="space-y-2.5">
              {embeddingVersionComparison.map(({ metric, current, previous }) => {
                const delta = (current - previous) / previous * 100
                const curPct  = ((current  - 0.6) / 0.4) * 100
                const prevPct = ((previous - 0.6) / 0.4) * 100
                const barColor = metric.startsWith('NDCG') ? C.blue : metric === 'MRR' ? C.purple : C.green
                return (
                  <div key={metric} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-[10px] text-muted-foreground">{metric}</span>
                    <div className="flex-1 space-y-0.5">
                      <div className="relative h-2 w-full overflow-hidden rounded-sm bg-muted">
                        <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${curPct}%`, backgroundColor: barColor }} />
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-sm bg-muted">
                        <div className="absolute inset-y-0 left-0 rounded-sm opacity-40" style={{ width: `${prevPct}%`, backgroundColor: barColor }} />
                      </div>
                    </div>
                    <span className="w-11 shrink-0 text-right text-[10px] font-semibold" style={{ color: delta >= 0 ? C.green : C.red }}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 레이턴시 + 처리량 + 클러스터 분석 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <SectionLabel>임베딩 레이턴시 추이 (12시간)</SectionLabel>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={embeddingLatencyHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fill: CHART_TICK, fontSize: 10 }} />
                <YAxis unit="ms" tick={{ fill: CHART_TICK, fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}ms`]} />
                <Line type="monotone" dataKey="p50" stroke={C.green}  strokeWidth={2} dot={false} name="p50" />
                <Line type="monotone" dataKey="p95" stroke={C.yellow} strokeWidth={2} dot={false} name="p95" />
                <Line type="monotone" dataKey="p99" stroke={C.red}    strokeWidth={2} dot={false} name="p99" strokeDasharray="4 4" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <SectionLabel>임베딩 처리량 추이 (12시간)</SectionLabel>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={embeddingRpsHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fill: CHART_TICK, fontSize: 10 }} />
                <YAxis tick={{ fill: CHART_TICK, fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${Number(v).toLocaleString()}/s`]} />
                <Line type="monotone" dataKey="prod"    stroke={C.green}  strokeWidth={2} dot={false} name="prod" />
                <Line type="monotone" dataKey="staging" stroke={C.yellow} strokeWidth={2} dot={false} name="staging" strokeDasharray="5 5" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <SectionLabel>실패 원인 클러스터 분석</SectionLabel>
            <ResponsiveContainer width="100%" height={190}>
              <ScatterChart margin={{ top: 5, right: 5, left: -20, bottom: 15 }}>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
                <XAxis dataKey="x" type="number" domain={[0.2, 1]} name="Retrieval Score"
                  tick={{ fill: CHART_TICK, fontSize: 10 }}
                  label={{ value: 'Retrieval', fill: CHART_TICK, fontSize: 10, position: 'insideBottom', offset: -8 }} />
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
      </div>

      {/* InferenceService 모니터링 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">InferenceService 모니터링</CardTitle>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="h-7 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {inferenceServices.map(svc => (
                  <SelectItem key={svc} value={svc} className="text-xs">{svc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md border p-3" style={{ borderColor: C.green + '66', backgroundColor: C.green + '0d' }}>
              <p className="mb-2 text-[11px] font-semibold text-muted-foreground">파드 상태</p>
              <div className="space-y-1.5">
                {[
                  { label: '목표 (Desired)',       value: podStatus.desired   },
                  { label: '준비 (Ready)',          value: podStatus.ready     },
                  { label: '사용 가능 (Available)', value: podStatus.available },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between rounded px-2 py-1" style={{ backgroundColor: C.green + '1a' }}>
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-sm font-bold" style={{ color: C.green }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center rounded-md border p-3">
              <p className="mb-2 text-[11px] font-semibold text-muted-foreground">429 비율 (%)</p>
              {rate429 === null ? (
                <p className="text-2xl font-bold text-muted-foreground">No data</p>
              ) : (
                <p className="text-4xl font-bold" style={{ color: rate429 > 5 ? C.red : C.green }}>{rate429.toFixed(2)}%</p>
              )}
            </div>
            <div className="flex flex-col items-center justify-center rounded-md border p-3">
              <p className="mb-2 text-[11px] font-semibold text-muted-foreground">현재 큐 대기 수</p>
              <p className="text-4xl font-bold" style={{ color: queueSize > 0 ? C.yellow : C.green }}>{queueSize}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <SectionLabel>큐 대기 수 (Queue Size)</SectionLabel>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={inferenceQueueSizeHistory} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fill: CHART_TICK, fontSize: 9 }} interval={2} />
                  <YAxis tick={{ fill: CHART_TICK, fontSize: 9 }} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="queueSize" stroke={C.blue} strokeWidth={2} dot={false} name="Queue Size" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <SectionLabel>큐 대기 시간 P50 / P95 / P99</SectionLabel>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={inferenceQueueLatencyHistory} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fill: CHART_TICK, fontSize: 9 }} interval={2} />
                  <YAxis unit="ms" tick={{ fill: CHART_TICK, fontSize: 9 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}ms`]} />
                  <Line type="monotone" dataKey="p50" stroke={C.green}  strokeWidth={2} dot={false} name="P50" />
                  <Line type="monotone" dataKey="p95" stroke={C.yellow} strokeWidth={2} dot={false} name="P95" />
                  <Line type="monotone" dataKey="p99" stroke={C.red}    strokeWidth={2} dot={false} name="P99" strokeDasharray="4 4" />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <SectionLabel>초당 요청 수 (RPS)</SectionLabel>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={inferenceRpsHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fill: CHART_TICK, fontSize: 9 }} interval={2} />
                  <YAxis tick={{ fill: CHART_TICK, fontSize: 9 }} tickFormatter={(v) => v.toFixed(2)} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${Number(v).toFixed(3)} req/s`]} />
                  <Line type="monotone" dataKey="rps" stroke={C.blue} strokeWidth={2} dot={false} name="RPS" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <SectionLabel>HTTP 상태코드별 RPS (Istio)</SectionLabel>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={inferenceHttpStatusRpsHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fill: CHART_TICK, fontSize: 9 }} interval={2} />
                    <YAxis tick={{ fill: CHART_TICK, fontSize: 9 }} tickFormatter={(v) => v.toFixed(3)} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${Number(v).toFixed(3)} req/s`]} />
                    <Line type="monotone" dataKey="s200" stroke={C.green}  strokeWidth={2} dot={false} name="200" />
                    <Line type="monotone" dataKey="s404" stroke={C.yellow} strokeWidth={2} dot={false} name="404" />
                    <Line type="monotone" dataKey="s503" stroke={C.red}    strokeWidth={2} dot={false} name="503" />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-1 text-left text-[11px] text-muted-foreground">Name</th>
                      <th className="pb-1 text-right text-[11px] text-muted-foreground">Last</th>
                      <th className="pb-1 text-right text-[11px] text-muted-foreground">Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: '200', color: C.green,  last: 0.133, max: 0.133 },
                      { name: '404', color: C.yellow, last: 0,     max: 0     },
                      { name: '503', color: C.red,    last: 0,     max: 0.02  },
                    ].map(row => (
                      <tr key={row.name}>
                        <td className="py-1">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: row.color }} />
                            <span style={{ color: row.color }}>{row.name}</span>
                          </span>
                        </td>
                        <td className="py-1 text-right font-mono">{row.last.toFixed(3)} req/s</td>
                        <td className="py-1 text-right font-mono">{row.max.toFixed(3)} req/s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 배포 이력 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4 text-muted-foreground" />
            배포 이력
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-0">
            {embeddingRolloutHistory.map((r, i) => {
              const dotColor =
                r.status === 'stable'  ? C.green  :
                r.status === 'exp'     ? C.blue   :
                r.status === 'retired' ? 'hsl(var(--muted-foreground))' : C.red
              const statusColor =
                r.status === 'stable' ? C.green :
                r.status === 'exp'    ? C.blue  : 'hsl(var(--muted-foreground))'
              const statusBg =
                r.status === 'stable' ? 'rgba(34,197,94,0.1)'  :
                r.status === 'exp'    ? 'rgba(59,130,246,0.1)' : 'hsl(var(--muted))'
              return (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="mt-1.5 h-2.5 w-2.5 rounded-full border-2"
                      style={{ borderColor: dotColor, backgroundColor: r.status === 'retired' ? 'transparent' : dotColor }} />
                    {i < embeddingRolloutHistory.length - 1 && (
                      <div className="w-px flex-1 bg-border" style={{ minHeight: 24 }} />
                    )}
                  </div>
                  <div className="space-y-1 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{r.version}</span>
                      <EnvBadge env={r.env as Environment} />
                      <span className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                        style={{ color: statusColor, backgroundColor: statusBg }}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{r.deployedAt}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// 응답품질 탭
// ────────────────────────────────────────────────────────────────
function GenerationTab({ version }: { version: RagVersion }) {
  const latest = evalPipelineRuns[0]
  const kpi    = ragVersionKpi[version]
  const radar  = ragVersionRadar[version]
  const trend  = ragVersionDailyTrend[version]

  const donutData = [
    { name: '통과', value: kpi.passRate },
    { name: '실패', value: 100 - kpi.passRate },
  ]

  const HOURS = ['00:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00']
  const CATS  = ['법률/규정', '기술문서', '내부정책', '제품/서비스']
  const heatMap = new Map<string, HeatmapCell>()
  ragHeatmapData.forEach(d => heatMap.set(`${d.hour}|${d.category}`, d))

  return (
    <div className="space-y-5">
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
                {i < latest.steps.length - 1 && <div className="h-px w-8 rounded bg-border" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div style={{ width: 68, height: 68, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={24} outerRadius={32}
                    dataKey="value" strokeWidth={0} startAngle={90} endAngle={-270}>
                    <Cell fill={kpi.gate === 'passed' ? C.green : C.red} />
                    <Cell fill="hsl(var(--muted))" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">통과율</p>
              <p className="text-2xl font-bold" style={{ color: kpi.gate === 'passed' ? C.green : C.red }}>{kpi.passRate}%</p>
              <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: kpi.gate === 'passed' ? C.green : C.red }}>
                {kpi.gate === 'passed' ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                {kpi.gate === 'passed' ? 'Gate 통과' : 'Gate 차단'}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">RAGAS Score</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: C.blue }}>{kpi.ragasScore.toFixed(3)}</p>
            <p className="text-[11px] text-muted-foreground">Faithfulness {kpi.faithfulness.toFixed(3)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-xs text-muted-foreground">평균 소요시간</p>
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-1 text-2xl font-bold">{Math.floor(kpi.avgDurationSec / 60)}m {kpi.avgDurationSec % 60}s</p>
            <p className="text-[11px] text-muted-foreground">{kpi.dataset} · {kpi.datasetSize}개</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-xs text-muted-foreground">추정 비용</p>
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-1 text-2xl font-bold">${kpi.costUsd.toFixed(2)}</p>
            <p className="text-[11px] text-muted-foreground">Answer Relevancy {kpi.answerRelevancy.toFixed(3)}</p>
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
                        <span className="font-bold" style={{ color: run.passRate >= 85 ? C.green : C.red }}>{run.passRate}%</span>
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
            <SectionLabel>버전 비교 레이더 · {version}</SectionLabel>
            <ResponsiveContainer width="100%" height={210}>
              <RadarChart data={radar} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                <PolarGrid stroke={CHART_GRID} />
                <PolarAngleAxis dataKey="metric" tick={{ fill: CHART_TICK, fontSize: 10 }} />
                <Radar name={version}   dataKey="current"  stroke={C.blue}   fill={C.blue}   fillOpacity={0.2}  strokeWidth={2} />
                <Radar name="이전 버전" dataKey="previous" stroke={C.purple} fill={C.purple} fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="4 4" />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-2 border-t pt-3">
              {radar.map(row => {
                const delta = ((row.current - row.previous) / row.previous * 100).toFixed(1)
                const up = row.current > row.previous
                return (
                  <div key={row.metric} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{row.metric}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold" style={{ color: up ? C.green : C.red }}>
                        {row.current.toFixed(1)}%
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

      {/* 트렌드 + 카테고리 분포 */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <SectionLabel>일별 성능 트렌드 (5일) · {version}</SectionLabel>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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

      {/* 히트맵 */}
      <Card>
        <CardContent className="p-4">
          <SectionLabel>시간대별 쿼리 통과율 히트맵</SectionLabel>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="pb-2 pr-4 text-left font-medium text-muted-foreground" style={{ minWidth: 80 }}>카테고리</th>
                  {HOURS.map(h => (
                    <th key={h} className="pb-2 text-center font-medium text-muted-foreground" style={{ minWidth: 76 }}>{h}</th>
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

// ────────────────────────────────────────────────────────────────
// 메인 페이지
// ────────────────────────────────────────────────────────────────
export default function EvaluationPage() {
  const [version, setVersion] = useState<RagVersion>(ragVersions[0])
  const kpi = ragVersionKpi[version]

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" style={{ color: C.purple }} />
            <h1 className="text-lg font-bold">RAG Evaluation</h1>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            MLflow · Prometheus · Argo CD 연동 · 30s 자동 갱신
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">버전</span>
          <Select value={version} onValueChange={(v) => setVersion(v as RagVersion)}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ragVersions.map(v => (
                <SelectItem key={v} value={v} className="text-xs">
                  <span className="flex items-center gap-2">
                    {v}
                    {v === ragVersions[0] && (
                      <span className="rounded px-1 py-0.5 text-[10px] font-medium" style={{ color: C.green, backgroundColor: 'rgba(34,197,94,0.1)' }}>
                        최신
                      </span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="rounded border px-2 py-1 text-xs text-muted-foreground">{kpi.dataset}</span>
          <span className="rounded border px-2 py-1 text-xs font-medium" style={{ color: kpi.gate === 'passed' ? C.green : C.red, borderColor: kpi.gate === 'passed' ? C.green + '66' : C.red + '66' }}>
            {kpi.gate === 'passed' ? 'Gate 통과' : 'Gate 차단'}
          </span>
          <button className="flex items-center gap-1 rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
            <RefreshCw className="h-3 w-3" /> 새로고침
          </button>
        </div>
      </div>

      <Tabs defaultValue="retrieval">
        <TabsList>
          <TabsTrigger value="retrieval">검색품질</TabsTrigger>
          <TabsTrigger value="generation">응답품질</TabsTrigger>
        </TabsList>
        <TabsContent value="retrieval" className="mt-5">
          <RetrievalTab version={version} />
        </TabsContent>
        <TabsContent value="generation" className="mt-5">
          <GenerationTab version={version} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
