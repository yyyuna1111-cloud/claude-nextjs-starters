'use client'

// MLOps 대시보드 Overview 페이지
// Recharts를 사용하므로 클라이언트 컴포넌트로 선언

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  Box,
  CheckCircle2,
  Clock,
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
import { Skeleton } from '@/components/ui/skeleton'

// ─────────────────────────────────────────────
// 더미 데이터 정의
// ─────────────────────────────────────────────

// 상단 요약 카드 - 카운터 타입 (숫자)
const counterCards = [
  {
    href: '/dashboard/train?status=Failed',
    label: '실패 Pipeline',
    value: 3,
    colorClass: 'text-red-400',
    bgClass: 'bg-red-400/10',
    icon: XCircle,
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
    href: '/dashboard/serving',
    label: '등록된 모델',
    value: 12,
    colorClass: 'text-violet-400',
    bgClass: 'bg-violet-400/10',
    icon: Box,
  },
]

// 상단 요약 카드 - 사용률 타입 (진행바)
// usageCards는 이제 DashboardPage 내부에서 동적으로 생성됩니다.

// 파이프라인 상태 트렌드 - 7일간 stacked bar
// 리소스 사용률 트렌드 - 24시간 multi-line
const resourceTrendData = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, '0')}:00`,
  gpu: Math.round(60 + Math.sin(i * 0.5) * 20 + Math.random() * 10),
  cpu: Math.round(45 + Math.cos(i * 0.4) * 15 + Math.random() * 8),
  memory: Math.round(55 + Math.sin(i * 0.3 + 1) * 12 + Math.random() * 6),
}))

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
// 학습 현황 - 진행 중 + 최근 완료
const trainRunningJobs = [
  {
    id: 'run-006',
    name: 'Stable Diffusion',
    epoch: 3,
    totalEpoch: 20,
    gpus: 8,
    elapsed: '2h 14m',
  },
  {
    id: 'run-001',
    name: 'ResNet50 파인튜닝',
    epoch: 7,
    totalEpoch: 10,
    gpus: 4,
    elapsed: '48m',
  },
  {
    id: 'run-007',
    name: 'T5 파인튜닝',
    epoch: 1,
    totalEpoch: 5,
    gpus: 1,
    elapsed: '12m',
  },
]
const trainCompletedJobs = [
  {
    id: 'run-003',
    name: 'COCO YOLOv8',
    duration: '4h 22m',
    metric: 'mAP 0.712',
    status: 'Succeeded' as const,
  },
  {
    id: 'run-004',
    name: 'Whisper 파인튜닝',
    duration: '1h 38m',
    metric: 'WER 8.4%',
    status: 'Failed' as const,
  },
  {
    id: 'run-005',
    name: 'ColabFilter',
    duration: '23m',
    metric: 'NDCG 0.631',
    status: 'Succeeded' as const,
  },
]

// 평가 현황 - 진행 중 + 최근 완료
const evalRunningJobs = [
  { id: 'eval-001', name: 'RAG Pipeline v2.1', type: 'RAGAS', elapsed: '18m' },
  { id: 'eval-002', name: 'Embedding 벤치마크', type: 'BEIR', elapsed: '5m' },
]
const evalCompletedJobs = [
  {
    id: 'eval-003',
    name: 'GPT-FT v2.3',
    metric: 'RAGAS 0.84',
    result: 'champion' as const,
    status: 'Succeeded' as const,
  },
  {
    id: 'eval-004',
    name: 'Whisper v1.2',
    metric: 'WER 8.4%',
    result: 'rejected' as const,
    status: 'Failed' as const,
  },
  {
    id: 'eval-005',
    name: 'YOLOv8-COCO',
    metric: 'mAP 0.712',
    result: 'champion' as const,
    status: 'Succeeded' as const,
  },
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
  status: 'Ready' | 'Not Ready' | 'Out of Sync' | 'Degraded'
}) {
  const config = {
    Ready: {
      label: 'Ready',
      className: 'bg-green-500/10 text-green-600 border-green-500/20',
    },
    'Not Ready': {
      label: 'Not Ready',
      className: 'bg-red-500/10 text-red-600 border-red-500/20',
    },
    'Out of Sync': {
      label: 'Out of Sync',
      className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    },
    Degraded: {
      label: 'Degraded',
      className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    },
  }
  const { label, className } = config[status] || config['Not Ready']
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${className}`}
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
  const [metrics, setMetrics] = useState({
    cpu: 0,
    memory: 0,
    gpu: 0,
    unhealthyPods: 0,
    totalServices: 0,
    unhealthyIsvcs: [] as any[],
    highMemoryNodes: [] as { node: string; used: number; free: number; type: string }[],
    unhealthyNamespaces: [] as { ns: string; running: number; pending: number; failed: number; crash: number; labels: string[] }[],
    loading: true
  })

  const fetchMetrics = async () => {
    try {
      const [nodeRes, gpuRes, podRes, isvcRes] = await Promise.all([
        fetch('/api/k8s/nodes'),
        fetch('/api/k8s/gpu'),
        fetch('/api/k8s/pods'),
        fetch('/api/k8s/isvcs')
      ])

      const nodeData = await nodeRes.json()
      const gpuData = await gpuRes.json()
      const podData = await podRes.json()
      const isvcData = await isvcRes.json()

      // CPU/Memory 평균 및 고부하 노드 계산
      const nodes = nodeData.nodes || []
      const avgCpu = nodes.length > 0 ? Math.round(nodes.reduce((s: number, n: any) => s + n.cpuUsage, 0) / nodes.length) : 0
      const avgMem = nodes.length > 0 ? Math.round(nodes.reduce((s: number, n: any) => s + n.memoryUsage, 0) / nodes.length) : 0

      // 메모리 90% 이상 노드 필터링
      const highMemNodes = nodes
        .filter((n: any) => n.memoryUsage >= 90)
        .map((n: any) => ({
          node: n.name.split('-').slice(-2).join('-'), // 이름 간소화
          used: n.memoryUsage,
          free: 100 - n.memoryUsage,
          type: n.role === 'control-plane' ? 'master' : (n.role === 'gpu-worker' ? 'gpu' : 'worker')
        }))

      // GPU 할당율 계산
      const allInstances = (gpuData.gpuNodes || []).flatMap((n: any) => n.devices.flatMap((d: any) => d.instances || []))
      const totalSlots = allInstances.length
      const activeSlots = allInstances.filter((inst: any) => inst.utilization > 5).length
      const gpuAllocated = totalSlots > 0 ? Math.round((activeSlots / totalSlots) * 100) : 0

      // 비정상 Pod 계산 및 네임스페이스별 집계
      const pods = podData.pods || []
      const unhealthyCount = (podData.failedCount || 0) + (podData.crashLoopCount || 0) + (podData.pendingCount || 0)

      const nsMap = new Map<string, any>()
      pods.forEach((p: any) => {
        if (!nsMap.has(p.namespace)) {
          nsMap.set(p.namespace, { ns: p.namespace, running: 0, pending: 0, failed: 0, crash: 0, labels: [] })
        }
        const nsData = nsMap.get(p.namespace)
        if (p.status === 'Running') nsData.running++
        else if (p.status === 'Pending') nsData.pending++
        else if (p.status === 'Failed') nsData.failed++
        else if (p.status === 'CrashLoopBackOff') nsData.crash++
      })

      // 비정상 Pod이 있는 네임스페이스만 필터링
      const unhealthyNamespaces = Array.from(nsMap.values())
        .filter(n => n.pending > 0 || n.failed > 0 || n.crash > 0)
        .sort((a, b) => (b.pending + b.failed + b.crash) - (a.pending + a.failed + a.crash))

      // Not Ready 이거나 Out of Sync 인 ISVC만 필터링
      const isvcs = isvcData.isvcs || []
      const unhealthyIsvcs = isvcs
        .filter((svc: any) => svc.status === 'NotReady' || svc.syncStatus === 'OutOfSync')
        .map((svc: any) => ({
          name: svc.name,
          namespace: svc.namespace,
          status: svc.status === 'NotReady' ? 'Not Ready' : 'Out of Sync'
        }))

      setMetrics({
        cpu: avgCpu,
        memory: avgMem,
        gpu: gpuAllocated,
        unhealthyPods: unhealthyCount,
        totalServices: isvcs.length,
        unhealthyIsvcs: unhealthyIsvcs,
        highMemoryNodes: highMemNodes,
        unhealthyNamespaces: unhealthyNamespaces,
        loading: false
      })
    } catch (err) {
      console.error('[Dashboard] Fetch Metrics Error:', err)
      setMetrics(prev => ({ ...prev, loading: false }))
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [])

  const dynamicCounterCards = [
    {
      href: '/dashboard/train?status=Failed',
      label: '실패 Pipeline',
      value: 3,
      colorClass: 'text-red-400',
      bgClass: 'bg-red-400/10',
      icon: XCircle,
    },
    {
      href: '/dashboard/infrastructure',
      label: '비정상 Pod',
      value: metrics.unhealthyPods,
      colorClass: metrics.unhealthyPods > 0 ? 'text-red-400' : 'text-emerald-400',
      bgClass: metrics.unhealthyPods > 0 ? 'bg-red-400/10' : 'bg-emerald-400/10',
      icon: metrics.unhealthyPods > 0 ? AlertTriangle : Server,
    },
    {
      href: '/dashboard/serving',
      label: '등록된 모델',
      value: metrics.totalServices,
      colorClass: 'text-violet-400',
      bgClass: 'bg-violet-400/10',
      icon: Box,
    },
  ]

  const usageCards = [
    {
      href: '/dashboard/infrastructure',
      label: 'GPU 할당율',
      value: metrics.gpu,
      colorClass: 'text-purple-500',
      barColorClass: '[&>div>div]:bg-purple-500',
      icon: Zap,
    },
    {
      href: '/dashboard/infrastructure',
      label: 'CPU 사용률 (평균)',
      value: metrics.cpu,
      colorClass: 'text-emerald-500',
      barColorClass: '[&>div>div]:bg-emerald-500',
      icon: Activity,
    },
    {
      href: '/dashboard/infrastructure',
      label: 'Memory 사용률 (평균)',
      value: metrics.memory,
      colorClass: 'text-blue-500',
      barColorClass: '[&>div>div]:bg-blue-500',
      icon: MemoryStick,
    },
  ]

  const filteredActivities = (() => {
    const list =
      activityFilter === 'all'
        ? recentActivities
        : recentActivities.filter(a =>
            activityFilter === 'deployment'
              ? a.type === 'deployment' || a.type === 'rollback'
              : a.type === activityFilter
          )
    return activityFilter === 'all' ? list.slice(0, 5) : list
  })()

  return (
    <div className="space-y-6 pb-10">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          MLOps 플랫폼 전체 현황을 실시간으로 확인합니다.
        </p>
      </div>

      {/* ─── 상단: Summary Cards ─── */}
      <section aria-label="요약 카드">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* 카운터 카드 3개 */}
          {dynamicCounterCards.map(card => {
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
                        {metrics.loading ? '...' : `${card.value}%`}
                      </p>
                    </div>
                    {metrics.loading ? (
                      <Skeleton className="mt-2 h-1.5 w-full" />
                    ) : (
                      <Progress
                        value={card.value}
                        className={`mt-2 h-1.5 ${card.barColorClass}`}
                      />
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ─── 하단: 운영 영역 (왼쪽: 서빙→학습→평가 / 오른쪽: 노드메모리+Pod+최근활동) ─── */}
      <section aria-label="운영 영역">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* ── 왼쪽: 서빙 → 학습 → 평가 세로 스택 ── */}
          <div className="flex flex-col gap-4">
            {/* 서빙 현황 */}
            <Card className={metrics.unhealthyIsvcs.length > 0 ? 'border-red-500/50 bg-red-500/[0.02]' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className={`text-sm font-semibold ${metrics.unhealthyIsvcs.length > 0 ? 'text-red-500' : ''}`}>
                      서빙 현황 (이슈 탐지)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {metrics.unhealthyIsvcs.length > 0 
                        ? `현재 ${metrics.unhealthyIsvcs.length}개의 서비스에 이상이 감지되었습니다.` 
                        : '모든 서비스가 정상적으로 운영 중입니다.'}
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
                {metrics.loading ? (
                  <div className="space-y-2 py-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : metrics.unhealthyIsvcs.length === 0 ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-2 border-t border-dashed rounded-xl border-emerald-500/20 bg-emerald-500/[0.01]">
                    <CheckCircle2 className="size-6 text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">All Services Healthy</span>
                  </div>
                ) : (
                  metrics.unhealthyIsvcs.map((svc, idx) => (
                    <div key={`${svc.namespace}-${svc.name}`}>
                      <Link href={`/dashboard/serving/${svc.name}?ns=${svc.namespace}`} className="hover:bg-muted/50 block rounded-md transition-colors px-1">
                        <div className="flex items-center justify-between py-1.5">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <Server className="text-muted-foreground size-3.5 shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="truncate text-sm font-medium">
                                {svc.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{svc.namespace}</span>
                            </div>
                          </div>
                          <ServingStatusBadge status={svc.status} />
                        </div>
                      </Link>
                      {idx < metrics.unhealthyIsvcs.length - 1 && <Separator />}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* 학습 현황 */}
            <Link href="/dashboard/train" className="group">
              <Card className="transition-shadow group-hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    학습 현황
                  </CardTitle>
                  <CardDescription className="text-xs">
                    진행 중 · 최근 완료
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
                      진행 중
                    </p>
                    <div className="space-y-2">
                      {trainRunningJobs.map(job => (
                        <div key={job.id}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="font-medium">{job.name}</span>
                            <span className="text-muted-foreground">
                              Epoch {job.epoch}/{job.totalEpoch} · GPU{' '}
                              {job.gpus}개 · {job.elapsed}
                            </span>
                          </div>
                          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{
                                width: `${(job.epoch / job.totalEpoch) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
                      최근 완료
                    </p>
                    <div className="space-y-1.5">
                      {trainCompletedJobs.map(job => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="min-w-0 truncate font-medium">
                            {job.name}
                          </span>
                          <span className="text-muted-foreground shrink-0">
                            {job.metric}
                          </span>
                          <span className="text-muted-foreground shrink-0">
                            {job.duration}
                          </span>
                          <Badge
                            variant={
                              job.status === 'Succeeded'
                                ? 'secondary'
                                : 'destructive'
                            }
                            className="shrink-0 text-[10px]"
                          >
                            {job.status === 'Succeeded' ? '완료' : '실패'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* 평가 현황 */}
            <Link href="/dashboard/evaluation" className="group">
              <Card className="transition-shadow group-hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    평가 현황
                  </CardTitle>
                  <CardDescription className="text-xs">
                    진행 중 · 최근 완료 · Champion 교체 여부
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
                      진행 중
                    </p>
                    <div className="space-y-1.5">
                      {evalRunningJobs.map(job => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="font-medium">{job.name}</span>
                          <span className="text-muted-foreground">
                            {job.type} · {job.elapsed} 경과
                          </span>
                          <Badge
                            variant="default"
                            className="bg-blue-500 text-[10px] hover:bg-blue-500"
                          >
                            실행 중
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
                      최근 완료
                    </p>
                    <div className="space-y-1.5">
                      {evalCompletedJobs.map(job => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="min-w-0 truncate font-medium">
                            {job.name}
                          </span>
                          <span className="text-muted-foreground shrink-0">
                            {job.metric}
                          </span>
                          {job.result === 'champion' ? (
                            <Badge
                              variant="default"
                              className="shrink-0 bg-emerald-500 text-[10px] hover:bg-emerald-500"
                            >
                              Champion 교체
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-[10px]"
                            >
                              보류
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            {/* 노드별 메모리 사용률 (Alert Focus) */}
            <Link href="/dashboard/infrastructure" className="group">
              <Card className={`transition-shadow group-hover:shadow-md ${metrics.highMemoryNodes.length > 0 ? 'border-red-500/50 bg-red-500/[0.02]' : ''}`}>
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className={`text-sm font-semibold ${metrics.highMemoryNodes.length > 0 ? 'text-red-500' : ''}`}>
                        메모리 임계치 초과 노드 (90%+)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {metrics.highMemoryNodes.length > 0 ? `현재 ${metrics.highMemoryNodes.length}개의 노드가 위험 상태입니다.` : '모든 노드가 안정 범위 내에 있습니다.'}
                      </CardDescription>
                    </div>
                    {metrics.highMemoryNodes.length > 0 && <AlertTriangle className="size-4 text-red-500 animate-pulse" />}
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {metrics.loading ? (
                    <div className="h-[200px] flex items-center justify-center"><Skeleton className="h-full w-full" /></div>
                  ) : metrics.highMemoryNodes.length === 0 ? (
                    <div className="h-[100px] flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl border-emerald-500/20 bg-emerald-500/[0.02]">
                       <CheckCircle2 className="size-6 text-emerald-500" />
                       <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">System Healthy</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(100, metrics.highMemoryNodes.length * 40)}>
                      <BarChart
                        data={metrics.highMemoryNodes}
                        layout="vertical"
                        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} hide />
                        <YAxis
                          type="category"
                          dataKey="node"
                          tick={{ fontSize: 10, fill: 'currentColor' }}
                          className="text-muted-foreground font-mono"
                          width={80}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                          formatter={(value) => [`${value}%`, '사용률']}
                        />
                        <Bar dataKey="used" radius={[0, 4, 4, 0]}>
                          {metrics.highMemoryNodes.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill="#ef4444" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </Link>

            {/* 네임스페이스별 Pod 상태 (Alert Focus) */}
            <Link href="/dashboard/infrastructure" className="group">
              <Card className={`transition-shadow group-hover:shadow-md ${metrics.unhealthyNamespaces.length > 0 ? 'border-amber-500/50 bg-amber-500/[0.02]' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className={`text-sm font-semibold ${metrics.unhealthyNamespaces.length > 0 ? 'text-amber-600' : ''}`}>
                        네임스페이스별 이슈 파드
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {metrics.unhealthyNamespaces.length > 0 ? '비정상 상태의 파드가 포함된 네임스페이스입니다.' : '모든 네임스페이스의 파드가 정상입니다.'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {metrics.loading ? (
                    <div className="p-6"><Skeleton className="h-20 w-full" /></div>
                  ) : metrics.unhealthyNamespaces.length === 0 ? (
                    <div className="py-10 flex flex-col items-center justify-center gap-2 border-t border-dashed">
                       <CheckCircle2 className="size-6 text-emerald-500" />
                       <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">All Pods Operational</span>
                    </div>
                  ) : (
                    <div className="max-h-[300px] overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-background/95 sticky top-0 backdrop-blur">
                          <tr className="text-muted-foreground border-b">
                            <th className="px-4 py-2 text-left font-medium">Namespace</th>
                            <th className="px-2 py-2 text-center font-medium text-[#fbbf24]">Pend</th>
                            <th className="px-2 py-2 text-center font-medium text-[#f87171]">Fail</th>
                            <th className="px-2 py-2 text-center font-medium text-[#a78bfa]">Crash</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.unhealthyNamespaces.map((row, idx) => (
                            <tr key={row.ns} className={idx < metrics.unhealthyNamespaces.length - 1 ? 'border-b' : ''}>
                              <td className="px-4 py-2.5 font-mono font-medium">{row.ns}</td>
                              <td className={`px-2 py-2.5 text-center font-semibold ${row.pending > 0 ? 'text-[#fbbf24]' : 'text-muted-foreground/30'}`}>{row.pending || '—'}</td>
                              <td className={`px-2 py-2.5 text-center font-semibold ${row.failed > 0 ? 'text-[#f87171]' : 'text-muted-foreground/30'}`}>{row.failed || '—'}</td>
                              <td className={`px-2 py-2.5 text-center font-semibold ${row.crash > 0 ? 'text-[#a78bfa]' : 'text-muted-foreground/30'}`}>{row.crash || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>

            {/* 최근 활동 */}
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
                    <span className="text-muted-foreground text-xs">
                      실시간
                    </span>
                  </div>
                </div>
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
        </div>
      </section>
    </div>
  )
}
