'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Box,
  CheckCircle2,
  Clock,
  Cpu,
  GitBranch,
  History,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
  Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  embeddingDeployments,
  embeddingLatencyHistory,
  embeddingQualityTrend,
  embeddingVersionComparison,
  embeddingRolloutHistory,
  embeddingRpsHistory,
  type EmbeddingDeployment,
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

function relTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diff < 60)   return `${diff}분 전`
  if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`
  return `${Math.floor(diff / 1440)}일 전`
}

function fmtVectors(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  )
}

function StatusDot({ status }: { status: EmbeddingDeployment['status'] }) {
  const cfg = {
    healthy:  { icon: <CheckCircle2 className="h-4 w-4" />, color: C.green,  label: 'Healthy'  },
    degraded: { icon: <XCircle      className="h-4 w-4" />, color: C.red,    label: 'Degraded' },
    updating: { icon: <Loader2      className="h-4 w-4 animate-spin" />, color: C.yellow, label: 'Updating' },
    failed:   { icon: <XCircle      className="h-4 w-4" />, color: C.red,    label: 'Failed'   },
  }[status]
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: cfg.color }}>
      {cfg.icon} {cfg.label}
    </span>
  )
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

export default function EmbeddingModelPage() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Box className="h-5 w-5" style={{ color: C.blue }} />
            <h1 className="text-lg font-bold">임베딩 모델</h1>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Argo CD · K8s metrics-server 연동 · 30s 자동 갱신
          </p>
        </div>
        <button className="flex items-center gap-1 rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
          <RefreshCw className="h-3 w-3" /> 새로고침
        </button>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '총 인덱싱 벡터', value: '4.82M',   sub: 'prod 기준',     icon: <Cpu    className="h-4 w-4 text-muted-foreground" />, color: C.blue   },
          { label: '임베딩 처리량',  value: '2,450/s', sub: 'prod 실시간',   icon: <Zap    className="h-4 w-4 text-muted-foreground" />, color: C.green  },
          { label: '평균 레이턴시',  value: '28ms',    sub: 'prod p50',      icon: <Clock  className="h-4 w-4 text-muted-foreground" />, color: C.purple },
          { label: 'NDCG@10',       value: '0.847',   sub: '+0.009 vs 이전', icon: <Search className="h-4 w-4 text-muted-foreground" />, color: C.orange },
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

      {/* 환경별 배포 상태 */}
      <div className="grid grid-cols-3 gap-4">
        {embeddingDeployments.map(dep => (
          <Card key={dep.environment}>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <EnvDot env={dep.environment} />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {dep.environment}
                  </span>
                </div>
                <StatusDot status={dep.status} />
              </div>
              <div>
                <p className="font-mono text-sm font-semibold">{dep.modelName}</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GitBranch className="h-3 w-3" />
                  <span className="font-mono">{dep.modelVersion}</span>
                  <span>·</span>
                  <span>dim {dep.dimension}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{relTime(dep.deployedAt)} 배포</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">레플리카</span>
                  <span style={{ color: dep.replicas.ready < dep.replicas.total ? C.yellow : C.green }}>
                    {dep.replicas.ready}/{dep.replicas.total} Ready
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${(dep.replicas.ready / dep.replicas.total) * 100}%`,
                      backgroundColor: dep.replicas.ready < dep.replicas.total ? C.yellow : C.green,
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-md bg-muted p-2 text-center text-xs">
                <div>
                  <p className="font-semibold" style={{ color: C.green }}>{dep.embeddingRps.toLocaleString()}/s</p>
                  <p className="text-muted-foreground">처리량</p>
                </div>
                <div>
                  <p className="font-semibold" style={{ color: C.blue }}>{dep.avgLatencyMs}ms</p>
                  <p className="text-muted-foreground">레이턴시</p>
                </div>
                <div>
                  <p className="font-semibold" style={{ color: C.purple }}>{fmtVectors(dep.indexedVectors)}</p>
                  <p className="text-muted-foreground">벡터 수</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 인프라 성능 차트 */}
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
              <AreaChart data={embeddingRpsHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.green}  stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.green}  stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="stagingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.yellow} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.yellow} stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fill: CHART_TICK, fontSize: 10 }} />
                <YAxis tick={{ fill: CHART_TICK, fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${Number(v).toLocaleString()}/s`]} />
                <Area type="monotone" dataKey="prod"    stroke={C.green}  fill="url(#prodGrad)"    strokeWidth={2} name="prod" />
                <Area type="monotone" dataKey="staging" stroke={C.yellow} fill="url(#stagingGrad)" strokeWidth={2} name="staging" strokeDasharray="5 5" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </AreaChart>
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
                  <span className="inline-block h-1.5 w-3 rounded-sm" style={{ backgroundColor: C.blue }} />
                  v1.5.0
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-3 rounded-sm opacity-40" style={{ backgroundColor: C.blue }} />
                  v1.4.2
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

      {/* 검색 품질 트렌드 + Argo CD */}
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
            <SectionLabel>Argo CD 앱 동기화 상태</SectionLabel>
            <div className="space-y-2">
              {[
                { app: 'embedding-server-prod',    env: 'prod'    as const, lastSync: '5일 전' },
                { app: 'embedding-server-staging', env: 'staging' as const, lastSync: '5일 전' },
                { app: 'embedding-server-dev',     env: 'dev'     as const, lastSync: '2일 전' },
              ].map(({ app, env, lastSync }) => (
                <div key={app} className="space-y-1.5 rounded-md bg-muted p-2.5">
                  <div className="flex items-center gap-1.5">
                    <EnvDot env={env} />
                    <span className="font-mono text-xs">{app}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {['Synced', 'Healthy'].map(label => (
                      <span key={label} className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: C.green }}>
                        {label}
                      </span>
                    ))}
                    <span className="text-[11px] text-muted-foreground">{lastSync} 동기화</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-2 border-t pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                롤링 배포 전략
              </p>
              {[
                { label: 'Strategy',        value: 'RollingUpdate' },
                { label: 'Max Surge',       value: '1'             },
                { label: 'Max Unavailable', value: '0'             },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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
                r.status === 'stable'  ? C.green  :
                r.status === 'exp'     ? C.blue   : 'hsl(var(--muted-foreground))'
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
