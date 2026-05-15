'use client'

// MLOps 대시보드 Overview 페이지
// Recharts를 사용하므로 클라이언트 컴포넌트로 선언

import { useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  GitBranch,
  HardDrive,
  MemoryStick,
  Play,
  RefreshCw,
  Server,
  XCircle,
  Zap,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

// ─────────────────────────────────────────────
// 더미 데이터 정의
// ─────────────────────────────────────────────

// 상단 요약 카드 - 카운터 타입 (숫자)
const counterCards = [
  {
    href: '/dashboard/deployment',
    label: '운영 중 서비스',
    value: 4,
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-400/10',
    icon: CheckCircle2,
  },
  {
    href: '/dashboard/infrastructure',
    label: '비정상 Pod',
    value: 2,
    colorClass: 'text-red-400',
    bgClass: 'bg-red-400/10',
    icon: Server,
  },
  {
    href: '/dashboard/monitoring',
    label: '실패 Pipeline',
    value: 3,
    colorClass: 'text-red-400',
    bgClass: 'bg-red-400/10',
    icon: XCircle,
  },
  {
    href: '/dashboard/evaluation',
    label: '평가 기준 미달',
    value: 5,
    colorClass: 'text-orange-400',
    bgClass: 'bg-orange-400/10',
    icon: AlertTriangle,
  },
  {
    href: '/dashboard/train',
    label: '진행 중 Train',
    value: 7,
    colorClass: 'text-blue-400',
    bgClass: 'bg-blue-400/10',
    icon: Play,
  },
]

// 상단 요약 카드 - 사용률 타입 (진행바)
const usageCards = [
  {
    href: '/dashboard/resources',
    label: 'GPU 사용률',
    value: 76,
    colorClass: 'text-purple-500',
    barColorClass: '[&>div>div]:bg-purple-500',
    icon: Zap,
  },
  {
    href: '/dashboard/resources',
    label: 'Memory 사용률',
    value: 61,
    colorClass: 'text-blue-500',
    barColorClass: '[&>div>div]:bg-blue-500',
    icon: MemoryStick,
  },
  {
    href: '/dashboard/resources',
    label: 'Storage 사용률',
    value: 84,
    colorClass: 'text-amber-500',
    barColorClass: '[&>div>div]:bg-amber-500',
    icon: HardDrive,
  },
]

// 파이프라인 상태 트렌드 - 7일간 stacked bar
const pipelineStatusData = [
  { date: '05/09', queued: 4, running: 3, succeeded: 8, failed: 1 },
  { date: '05/10', queued: 2, running: 5, succeeded: 10, failed: 2 },
  { date: '05/11', queued: 6, running: 4, succeeded: 7, failed: 0 },
  { date: '05/12', queued: 3, running: 6, succeeded: 12, failed: 3 },
  { date: '05/13', queued: 5, running: 2, succeeded: 9, failed: 1 },
  { date: '05/14', queued: 1, running: 7, succeeded: 11, failed: 2 },
  { date: '05/15', queued: 4, running: 5, succeeded: 6, failed: 3 },
]

// 리소스 사용률 트렌드 - 24시간 multi-line
const resourceTrendData = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, '0')}:00`,
  gpu: Math.round(60 + Math.sin(i * 0.5) * 20 + Math.random() * 10),
  cpu: Math.round(45 + Math.cos(i * 0.4) * 15 + Math.random() * 8),
  memory: Math.round(55 + Math.sin(i * 0.3 + 1) * 12 + Math.random() * 6),
}))

// 장애 및 알림 트렌드 - 7일간 stacked bar
const failureAlertData = [
  {
    date: '05/09',
    trainFail: 1,
    evalFail: 0,
    deployFail: 1,
    servingFail: 0,
    infraFail: 1,
  },
  {
    date: '05/10',
    trainFail: 2,
    evalFail: 1,
    deployFail: 0,
    servingFail: 1,
    infraFail: 0,
  },
  {
    date: '05/11',
    trainFail: 0,
    evalFail: 2,
    deployFail: 1,
    servingFail: 0,
    infraFail: 1,
  },
  {
    date: '05/12',
    trainFail: 3,
    evalFail: 1,
    deployFail: 2,
    servingFail: 1,
    infraFail: 0,
  },
  {
    date: '05/13',
    trainFail: 1,
    evalFail: 0,
    deployFail: 0,
    servingFail: 2,
    infraFail: 1,
  },
  {
    date: '05/14',
    trainFail: 2,
    evalFail: 1,
    deployFail: 1,
    servingFail: 0,
    infraFail: 2,
  },
  {
    date: '05/15',
    trainFail: 1,
    evalFail: 2,
    deployFail: 0,
    servingFail: 1,
    infraFail: 0,
  },
]

// 노드별 메모리 사용률 (GPU 노드 vs CPU 노드 구분)
const nodeMemoryData = [
  { node: 'gpu-node-01', used: 88, free: 12, type: 'GPU' },
  { node: 'gpu-node-02', used: 72, free: 28, type: 'GPU' },
  { node: 'gpu-node-03', used: 65, free: 35, type: 'GPU' },
  { node: 'gpu-node-04', used: 91, free: 9, type: 'GPU' },
  { node: 'cpu-node-01', used: 45, free: 55, type: 'CPU' },
  { node: 'cpu-node-02', used: 38, free: 62, type: 'CPU' },
]
// 노드 타입별 색상
const NODE_COLORS = { GPU: '#60a5fa', CPU: '#4ade80' }

// 서빙 헬스 데이터
const servingHealthData = [
  {
    name: 'Chat',
    href: '/dashboard/serving',
    status: 'UP' as const,
    latency: '42ms',
    errorRate: '0.1%',
    rps: '1,240',
  },
  {
    name: 'Embedding',
    href: '/dashboard/serving',
    status: 'UP' as const,
    latency: '18ms',
    errorRate: '0.0%',
    rps: '3,580',
  },
  {
    name: 'LLM',
    href: '/dashboard/serving',
    status: 'DEGRADED' as const,
    latency: '310ms',
    errorRate: '2.4%',
    rps: '420',
  },
  {
    name: 'RAG Pipeline',
    href: '/dashboard/serving',
    status: 'DOWN' as const,
    latency: '—',
    errorRate: '100%',
    rps: '0',
  },
]

// 네임스페이스별 Pod 상태 요약
const podNamespaceData = [
  {
    ns: 'mlops',
    running: 18,
    pending: 3,
    failed: 1,
    crash: 1,
    labels: ['train', 'eval'],
  },
  {
    ns: 'serving',
    running: 12,
    pending: 2,
    failed: 0,
    crash: 0,
    labels: ['api'],
  },
  {
    ns: 'monitoring',
    running: 8,
    pending: 0,
    failed: 0,
    crash: 0,
    labels: ['prom', 'grafana'],
  },
  {
    ns: 'kube-system',
    running: 4,
    pending: 3,
    failed: 1,
    crash: 0,
    labels: ['system'],
  },
]

// 스토리지 사용량 - stacked bar
const storageUsageData = [
  { category: 'Dataset', dataset: 420, model: 0, artifacts: 0, logs: 0 },
  { category: 'Model', dataset: 0, model: 890, artifacts: 0, logs: 0 },
  { category: 'Artifacts', dataset: 0, model: 0, artifacts: 310, logs: 0 },
  { category: 'Logs', dataset: 0, model: 0, artifacts: 0, logs: 150 },
]

// 최근 활동 타임라인
type ActivityType = 'train' | 'evaluation' | 'deployment' | 'rollback' | 'alert'
type ActivityStatus = 'success' | 'failed' | 'running' | 'warning'

interface ActivityItem {
  id: number
  type: ActivityType
  description: string
  time: string
  status: ActivityStatus
  href: string
}

const recentActivities: ActivityItem[] = [
  {
    id: 1,
    type: 'train',
    description: 'GPT-Fine-Tune v2.3 학습 완료',
    time: '5분 전',
    status: 'success',
    href: '/dashboard/train',
  },
  {
    id: 2,
    type: 'alert',
    description: 'LLM API 응답 지연 감지 (p99 > 300ms)',
    time: '12분 전',
    status: 'warning',
    href: '/dashboard/monitoring',
  },
  {
    id: 3,
    type: 'deployment',
    description: 'Chat API v1.8.2 배포 성공',
    time: '28분 전',
    status: 'success',
    href: '/dashboard/deployment',
  },
  {
    id: 4,
    type: 'evaluation',
    description: 'Eval-BLEU 점수 기준 미달 (0.31 < 0.35)',
    time: '41분 전',
    status: 'failed',
    href: '/dashboard/evaluation',
  },
  {
    id: 5,
    type: 'rollback',
    description: 'Embedding API v2.1.0 → v2.0.9 롤백',
    time: '1시간 전',
    status: 'warning',
    href: '/dashboard/deployment',
  },
  {
    id: 6,
    type: 'train',
    description: 'BERT-KO Fine-Tune 학습 시작',
    time: '1시간 23분 전',
    status: 'running',
    href: '/dashboard/train',
  },
  {
    id: 7,
    type: 'deployment',
    description: 'RAG Pipeline v0.9.5 배포 실패',
    time: '2시간 전',
    status: 'failed',
    href: '/dashboard/deployment',
  },
  {
    id: 8,
    type: 'evaluation',
    description: 'LLM-v3 모델 평가 완료 (F1: 0.89)',
    time: '3시간 전',
    status: 'success',
    href: '/dashboard/evaluation',
  },
]

// 카테고리 필터 정의
type ActivityFilter = 'all' | 'train' | 'evaluation' | 'deployment' | 'alert'
const ACTIVITY_FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'train', label: 'Train' },
  { key: 'evaluation', label: 'Evaluation' },
  { key: 'deployment', label: 'Deployment' },
  { key: 'alert', label: 'Alert' },
]

// ─────────────────────────────────────────────
// 헬퍼 컴포넌트 및 유틸
// ─────────────────────────────────────────────

// 서빙 상태 배지 색상 매핑
function ServingStatusBadge({
  status,
}: {
  status: 'UP' | 'DOWN' | 'DEGRADED'
}) {
  const config = {
    UP: {
      label: 'UP',
      className: 'bg-green-500/10 text-green-600 border-green-500/20',
    },
    DOWN: {
      label: 'DOWN',
      className: 'bg-red-500/10 text-red-600 border-red-500/20',
    },
    DEGRADED: {
      label: 'DEGRADED',
      className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    },
  }
  const { label, className } = config[status]
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}

// 활동 타입별 아이콘 및 색상
function ActivityIcon({ type }: { type: ActivityType }) {
  const config: Record<
    ActivityType,
    { icon: React.ReactNode; className: string }
  > = {
    train: {
      icon: <Play className="size-3.5" />,
      className: 'bg-blue-500/10 text-blue-500',
    },
    evaluation: {
      icon: <Activity className="size-3.5" />,
      className: 'bg-orange-500/10 text-orange-500',
    },
    deployment: {
      icon: <GitBranch className="size-3.5" />,
      className: 'bg-green-500/10 text-green-500',
    },
    rollback: {
      icon: <RefreshCw className="size-3.5" />,
      className: 'bg-amber-500/10 text-amber-500',
    },
    alert: {
      icon: <AlertTriangle className="size-3.5" />,
      className: 'bg-red-500/10 text-red-500',
    },
  }
  const { icon, className } = config[type]
  return (
    <div
      className={`flex size-6 shrink-0 items-center justify-center rounded-full ${className}`}
    >
      {icon}
    </div>
  )
}

// 활동 상태 배지
function ActivityStatusBadge({ status }: { status: ActivityStatus }) {
  const config: Record<
    ActivityStatus,
    {
      label: string
      variant: 'default' | 'secondary' | 'destructive' | 'outline'
    }
  > = {
    success: { label: '성공', variant: 'secondary' },
    failed: { label: '실패', variant: 'destructive' },
    running: { label: '진행 중', variant: 'default' },
    warning: { label: '경고', variant: 'outline' },
  }
  const { label, variant } = config[status]
  return (
    <Badge variant={variant} className="text-xs">
      {label}
    </Badge>
  )
}

// ─────────────────────────────────────────────
// 메인 페이지 컴포넌트
// ─────────────────────────────────────────────

export default function DashboardPage() {
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')

  const filteredActivities =
    activityFilter === 'all'
      ? recentActivities
      : recentActivities.filter(a =>
          activityFilter === 'deployment'
            ? a.type === 'deployment' || a.type === 'rollback'
            : a.type === activityFilter
        )

  return (
    <div className="space-y-6 pb-10">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          MLOps 플랫폼 전체 현황을 실시간으로 확인합니다.
        </p>
      </div>

      {/* ─── 상단: Summary Cards (8개, 2줄 grid) ─── */}
      <section aria-label="요약 카드">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* 카운터 카드 5개 */}
          {counterCards.map(card => {
            const Icon = card.icon
            return (
              <Link key={card.label} href={card.href} className="group">
                <Card className="gap-3 py-4 transition-shadow group-hover:shadow-md">
                  <CardContent className="px-4">
                    <div className="flex items-center justify-between">
                      <p className="text-muted-foreground text-xs leading-snug font-medium">
                        {card.label}
                      </p>
                      <div
                        className={`flex size-7 items-center justify-center rounded-md ${card.bgClass}`}
                      >
                        <Icon className={`size-3.5 ${card.colorClass}`} />
                      </div>
                    </div>
                    <p className={`mt-2 text-3xl font-bold ${card.colorClass}`}>
                      {card.value}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>

        {/* 사용률 카드 3개 */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {usageCards.map(card => {
            const Icon = card.icon
            return (
              <Link key={card.label} href={card.href} className="group">
                <Card className="gap-3 py-4 transition-shadow group-hover:shadow-md">
                  <CardContent className="px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Icon className={`size-3.5 ${card.colorClass}`} />
                        <p className="text-muted-foreground text-xs font-medium">
                          {card.label}
                        </p>
                      </div>
                      <p className={`text-sm font-bold ${card.colorClass}`}>
                        {card.value}%
                      </p>
                    </div>
                    <Progress
                      value={card.value}
                      className={`mt-2 h-1.5 ${card.barColorClass}`}
                    />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ─── 중단: 핵심 그래프 (2x2 grid) ─── */}
      <section aria-label="핵심 그래프">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 1. Pipeline Status Trend */}
          <Link href="/dashboard/pipelines" className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold">
                  파이프라인 상태 추이
                </CardTitle>
                <CardDescription className="text-xs">
                  최근 7일간 파이프라인 상태 추이
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={pipelineStatusData}
                    margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      opacity={0.8}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{
                        fontSize: 11,
                        fill: 'hsl(var(--foreground))',
                        opacity: 0.75,
                      }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      tick={{
                        fontSize: 11,
                        fill: 'hsl(var(--foreground))',
                        opacity: 0.75,
                      }}
                      stroke="hsl(var(--border))"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#f1f5f9',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        padding: '8px 12px',
                      }}
                      labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                      itemStyle={{ color: '#f1f5f9' }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: '11px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Bar
                      dataKey="queued"
                      stackId="a"
                      fill="#94a3b8"
                      name="Queued"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="running"
                      stackId="a"
                      fill="#38bdf8"
                      name="Running"
                    />
                    <Bar
                      dataKey="succeeded"
                      stackId="a"
                      fill="#34d399"
                      name="Succeeded"
                    />
                    <Bar
                      dataKey="failed"
                      stackId="a"
                      fill="#fb7185"
                      name="Failed"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Link>

          {/* 2. Resource Usage Trend */}
          <Link href="/dashboard/resources" className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold">
                  리소스 사용률 추이
                </CardTitle>
                <CardDescription className="text-xs">
                  최근 24시간 GPU / CPU / Memory 사용률 (%)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={resourceTrendData}
                    margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      opacity={0.8}
                    />
                    <XAxis
                      dataKey="time"
                      tick={{
                        fontSize: 10,
                        fill: 'hsl(var(--foreground))',
                        opacity: 0.75,
                      }}
                      stroke="hsl(var(--border))"
                      interval={3}
                    />
                    <YAxis
                      tick={{
                        fontSize: 11,
                        fill: 'hsl(var(--foreground))',
                        opacity: 0.75,
                      }}
                      stroke="hsl(var(--border))"
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#f1f5f9',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        padding: '8px 12px',
                      }}
                      labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                      itemStyle={{ color: '#f1f5f9' }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: '11px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="gpu"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      dot={false}
                      name="GPU"
                    />
                    <Line
                      type="monotone"
                      dataKey="cpu"
                      stroke="#60a5fa"
                      strokeWidth={2}
                      dot={false}
                      name="CPU"
                    />
                    <Line
                      type="monotone"
                      dataKey="memory"
                      stroke="#4ade80"
                      strokeWidth={2}
                      dot={false}
                      name="Memory"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Link>

          {/* 3. Failure & Alert Trend */}
          <Link href="/dashboard/alerts" className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-0">
                <CardTitle className="text-sm font-semibold">
                  장애 및 알림 추이
                </CardTitle>
                <CardDescription className="text-xs">
                  최근 7일간 장애 유형별 발생 현황
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={failureAlertData}
                    margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      opacity={0.8}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{
                        fontSize: 11,
                        fill: 'hsl(var(--foreground))',
                        opacity: 0.75,
                      }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      tick={{
                        fontSize: 11,
                        fill: 'hsl(var(--foreground))',
                        opacity: 0.75,
                      }}
                      stroke="hsl(var(--border))"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#f1f5f9',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        padding: '8px 12px',
                      }}
                      labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                      itemStyle={{ color: '#f1f5f9' }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: '11px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Bar
                      dataKey="trainFail"
                      stackId="a"
                      fill="#60a5fa"
                      name="학습 실패"
                    />
                    <Bar
                      dataKey="evalFail"
                      stackId="a"
                      fill="#fbbf24"
                      name="평가 실패"
                    />
                    <Bar
                      dataKey="deployFail"
                      stackId="a"
                      fill="#a78bfa"
                      name="배포 실패"
                    />
                    <Bar
                      dataKey="servingFail"
                      stackId="a"
                      fill="#f87171"
                      name="서빙 장애"
                    />
                    <Bar
                      dataKey="infraFail"
                      stackId="a"
                      fill="#94a3b8"
                      name="인프라 장애"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Link>

          {/* 4. Memory Usage by Node */}
          <Link href="/dashboard/infrastructure" className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      노드별 메모리 사용률
                    </CardTitle>
                    <CardDescription className="text-xs">
                      GPU 노드 / CPU 노드 구분 (%)
                    </CardDescription>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <span className="inline-block size-2 rounded-full bg-[#60a5fa]" />
                      GPU
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block size-2 rounded-full bg-[#4ade80]" />
                      CPU
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={nodeMemoryData}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{
                        fontSize: 11,
                        fill: 'hsl(var(--foreground))',
                        opacity: 0.75,
                      }}
                      stroke="hsl(var(--border))"
                      tickFormatter={v => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="node"
                      tick={{
                        fontSize: 11,
                        fill: 'hsl(var(--foreground))',
                        opacity: 0.75,
                      }}
                      stroke="hsl(var(--border))"
                      width={88}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#f1f5f9',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        padding: '8px 12px',
                      }}
                      labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                      itemStyle={{ color: '#f1f5f9' }}
                      formatter={(value, name, props) => [
                        `${value}%`,
                        name === 'used'
                          ? `Used (${props.payload.type} 노드)`
                          : 'Free',
                      ]}
                    />
                    <Bar dataKey="used" name="used">
                      {nodeMemoryData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={
                            NODE_COLORS[entry.type as keyof typeof NODE_COLORS]
                          }
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="free"
                      name="free"
                      fill="#e2e8f0"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* ─── 하단: 운영 영역 (2x2 grid) ─── */}
      <section aria-label="운영 영역">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 5. Serving Health */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    서비스 상태
                  </CardTitle>
                  <CardDescription className="text-xs">
                    서비스별 운영 상태
                  </CardDescription>
                </div>
                <Link
                  href="/dashboard/serving"
                  className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                >
                  전체 보기
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {servingHealthData.map((svc, idx) => (
                <div key={svc.name}>
                  <div className="flex items-center gap-3 py-1.5">
                    {/* 서비스명 + 상태 */}
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Server className="text-muted-foreground size-3.5 shrink-0" />
                      <span className="truncate text-sm font-medium">
                        {svc.name}
                      </span>
                    </div>
                    <ServingStatusBadge status={svc.status} />
                    {/* 메트릭 */}
                    <div className="text-muted-foreground hidden items-center gap-4 text-xs sm:flex">
                      <span>
                        <span className="text-foreground font-medium">
                          {svc.latency}
                        </span>{' '}
                        latency
                      </span>
                      <span>
                        <span className="text-foreground font-medium">
                          {svc.errorRate}
                        </span>{' '}
                        err
                      </span>
                      <span>
                        <span className="text-foreground font-medium">
                          {svc.rps}
                        </span>{' '}
                        rps
                      </span>
                    </div>
                  </div>
                  {idx < servingHealthData.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 6. Pod Health by Namespace */}
          <Link href="/dashboard/infrastructure" className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  네임스페이스별 Pod 상태
                </CardTitle>
                <CardDescription className="text-xs">
                  네임스페이스별 Pod 상태 요약
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b">
                      <th className="px-4 py-2 text-left font-medium">
                        Namespace
                      </th>
                      <th className="px-2 py-2 text-center font-medium text-[#4ade80]">
                        Run
                      </th>
                      <th className="px-2 py-2 text-center font-medium text-[#fbbf24]">
                        Pend
                      </th>
                      <th className="px-2 py-2 text-center font-medium text-[#f87171]">
                        Fail
                      </th>
                      <th className="px-2 py-2 text-center font-medium text-[#a78bfa]">
                        Crash
                      </th>
                      <th className="px-4 py-2 text-left font-medium">
                        Labels
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {podNamespaceData.map((row, idx) => (
                      <tr
                        key={row.ns}
                        className={
                          idx < podNamespaceData.length - 1 ? 'border-b' : ''
                        }
                      >
                        <td className="px-4 py-2.5 font-mono font-medium">
                          {row.ns}
                        </td>
                        <td className="px-2 py-2.5 text-center font-semibold text-[#4ade80]">
                          {row.running}
                        </td>
                        <td className="px-2 py-2.5 text-center font-semibold text-[#fbbf24]">
                          {row.pending || '—'}
                        </td>
                        <td className="px-2 py-2.5 text-center font-semibold text-[#f87171]">
                          {row.failed || '—'}
                        </td>
                        <td className="px-2 py-2.5 text-center font-semibold text-[#a78bfa]">
                          {row.crash || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {row.labels.map(l => (
                              <span
                                key={l}
                                className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]"
                              >
                                {l}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </Link>

          {/* 7. Storage Usage */}
          <Link href="/dashboard/resources" className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  스토리지 사용량
                </CardTitle>
                <CardDescription className="text-xs">
                  유형별 스토리지 사용량 (GB)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={storageUsageData}
                    margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      opacity={0.8}
                    />
                    <XAxis
                      dataKey="category"
                      tick={{
                        fontSize: 11,
                        fill: 'hsl(var(--foreground))',
                        opacity: 0.75,
                      }}
                      stroke="hsl(var(--border))"
                    />
                    <YAxis
                      tick={{
                        fontSize: 11,
                        fill: 'hsl(var(--foreground))',
                        opacity: 0.75,
                      }}
                      stroke="hsl(var(--border))"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#f1f5f9',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        padding: '8px 12px',
                      }}
                      labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                      itemStyle={{ color: '#f1f5f9' }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: '11px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Bar
                      dataKey="dataset"
                      stackId="a"
                      fill="#60a5fa"
                      name="Dataset"
                    />
                    <Bar
                      dataKey="model"
                      stackId="a"
                      fill="#a78bfa"
                      name="Model"
                    />
                    <Bar
                      dataKey="artifacts"
                      stackId="a"
                      fill="#4ade80"
                      name="Artifacts"
                    />
                    <Bar
                      dataKey="logs"
                      stackId="a"
                      fill="#fbbf24"
                      name="Logs"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Link>

          {/* 8. Recent Activity Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    최근 활동
                  </CardTitle>
                  <CardDescription className="text-xs">
                    최근 이벤트 타임라인
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="text-muted-foreground size-3.5" />
                  <span className="text-muted-foreground text-xs">실시간</span>
                </div>
              </div>
              {/* 카테고리 필터 버튼 */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ACTIVITY_FILTERS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setActivityFilter(f.key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      activityFilter === f.key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              <div className="space-y-0">
                {filteredActivities.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center text-xs">
                    이벤트가 없습니다.
                  </p>
                ) : (
                  filteredActivities.map((activity, idx) => (
                    <div key={activity.id}>
                      <Link
                        href={activity.href}
                        className="hover:bg-muted/50 flex items-start gap-3 rounded-md py-2.5 transition-colors"
                      >
                        <ActivityIcon type={activity.type} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug">
                            {activity.description}
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {activity.time}
                          </p>
                        </div>
                        <ActivityStatusBadge status={activity.status} />
                      </Link>
                      {idx < filteredActivities.length - 1 && <Separator />}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
