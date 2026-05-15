'use client'

// Train 상세 페이지 - 학습 실행 상세 정보, KFP 파이프라인 단계, 메트릭 차트, 리소스 사용률, 로그 뷰어
// TODO: KFP API - GET /apis/v2beta1/runs/{runId}
// TODO: Prometheus - gpu_utilization{pod=~"train-.*"}
// TODO: K8s Pod Logs - GET /api/v1/namespaces/{ns}/pods/{pod}/log

import { useRef } from 'react'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  RefreshCwIcon,
  XCircleIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
  ClockIcon,
  CircleDotIcon,
  AlertCircleIcon,
  DownloadIcon,
  CpuIcon,
  MemoryStickIcon,
  ActivityIcon,
  ServerIcon,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

// ─── 타입 정의 ─────────────────────────────────────────────────────────────────

type TrainStatus = 'Running' | 'Succeeded' | 'Failed' | 'Queued' | 'Canceled'

type StepStatus = 'completed' | 'running' | 'pending' | 'failed'

interface PipelineStep {
  id: string
  name: string
  label: string
  status: StepStatus
  duration: string | null
}

interface MetricPoint {
  epoch: number
  train_loss: number
  val_loss: number
  train_acc: number
  val_acc: number
}

interface ResourceSnapshot {
  t: number
  value: number
}

interface ResourceCard {
  label: string
  current: string
  unit: string
  color: string
  data: ResourceSnapshot[]
}

// ─── 더미 데이터 ───────────────────────────────────────────────────────────────

// 학습 실행 기본 정보 더미 데이터
const dummyRun = {
  runId: 'run-20240101-003',
  trainName: 'COCO 데이터셋 학습',
  projectName: '객체 탐지 YOLOv8',
  status: 'Running' as TrainStatus,
  requester: '박민준',
  startedAt: '2026-05-15 09:12:34',
  endedAt: null,
  gpuCount: 4,
  trainMode: '분산 학습',
}

// KFP 파이프라인 4단계 더미 데이터
const dummySteps: PipelineStep[] = [
  {
    id: 'prepare',
    name: 'prepare',
    label: 'Prepare',
    status: 'completed',
    duration: '2m 14s',
  },
  {
    id: 'train',
    name: 'train',
    label: 'Train',
    status: 'running',
    duration: null,
  },
  {
    id: 'evaluate',
    name: 'evaluate',
    label: 'Evaluate',
    status: 'pending',
    duration: null,
  },
  {
    id: 'register',
    name: 'register',
    label: 'Register',
    status: 'pending',
    duration: null,
  },
]

// 30 epoch 학습 메트릭 더미 데이터 생성
const dummyMetrics: MetricPoint[] = Array.from({ length: 30 }, (_, i) => {
  const epoch = i + 1
  const progress = epoch / 30
  return {
    epoch,
    // loss: 초반엔 크고 점점 감소하는 곡선
    train_loss: parseFloat(
      (2.4 * Math.exp(-progress * 3.2) + 0.12 + Math.random() * 0.04).toFixed(4)
    ),
    val_loss: parseFloat(
      (2.6 * Math.exp(-progress * 2.9) + 0.18 + Math.random() * 0.06).toFixed(4)
    ),
    // accuracy: 초반엔 낮고 점점 증가하는 곡선
    train_acc: parseFloat(
      (1 - Math.exp(-progress * 3.5) * 0.92 + Math.random() * 0.02).toFixed(4)
    ),
    val_acc: parseFloat(
      (1 - Math.exp(-progress * 3.0) * 0.95 + Math.random() * 0.025).toFixed(4)
    ),
  }
})

// 리소스 사용률 sparkline용 시계열 데이터 생성 헬퍼
function makeSparkline(base: number, variance: number): ResourceSnapshot[] {
  return Array.from({ length: 20 }, (_, i) => ({
    t: i,
    value: parseFloat((base + (Math.random() - 0.5) * variance * 2).toFixed(1)),
  }))
}

// 리소스 카드 더미 데이터
const dummyResources: ResourceCard[] = [
  {
    label: 'GPU 사용률',
    current: '87.3',
    unit: '%',
    color: '#3b82f6',
    data: makeSparkline(87, 8),
  },
  {
    label: 'GPU Memory',
    current: '74.1',
    unit: 'GB / 80GB',
    color: '#8b5cf6',
    data: makeSparkline(74, 5),
  },
  {
    label: 'CPU 사용률',
    current: '42.6',
    unit: '%',
    color: '#10b981',
    data: makeSparkline(42, 12),
  },
  {
    label: 'RAM 사용률',
    current: '58.2',
    unit: 'GB / 128GB',
    color: '#f59e0b',
    data: makeSparkline(58, 6),
  },
]

// 탭별 더미 로그 데이터
const dummyLogs: Record<string, string[]> = {
  prepare: [
    '[2026-05-15 09:12:34] INFO  Starting prepare stage...',
    '[2026-05-15 09:12:35] INFO  Connecting to dataset registry: s3://mlops-datasets/coco2017',
    '[2026-05-15 09:12:36] INFO  Downloading annotations: instances_train2017.json (252 MB)',
    '[2026-05-15 09:12:48] INFO  Download complete. Validating checksums...',
    '[2026-05-15 09:12:50] INFO  Checksum OK: SHA256 a3e3b4c5d6e7f8a9...',
    '[2026-05-15 09:12:51] INFO  Extracting image shards: 118,287 images found',
    '[2026-05-15 09:13:10] INFO  Building data index... [32 workers]',
    '[2026-05-15 09:13:42] INFO  Data index built. Writing to cache: /data/coco_index.pkl',
    '[2026-05-15 09:14:08] INFO  Splitting dataset: train=105,824 / val=12,463',
    '[2026-05-15 09:14:22] INFO  Preprocessing pipeline initialized (resize=640, normalize=ImageNet)',
    '[2026-05-15 09:14:28] INFO  Prepare stage completed in 2m 14s ✓',
  ],
  train: [
    '[2026-05-15 09:14:30] INFO  Starting train stage...',
    '[2026-05-15 09:14:31] INFO  Initializing distributed training: 4 GPUs (NCCL backend)',
    '[2026-05-15 09:14:32] INFO  GPU 0: NVIDIA A100 80GB | CUDA 12.2',
    '[2026-05-15 09:14:32] INFO  GPU 1: NVIDIA A100 80GB | CUDA 12.2',
    '[2026-05-15 09:14:32] INFO  GPU 2: NVIDIA A100 80GB | CUDA 12.2',
    '[2026-05-15 09:14:32] INFO  GPU 3: NVIDIA A100 80GB | CUDA 12.2',
    '[2026-05-15 09:14:35] INFO  Loading model: YOLOv8x (68.2M parameters)',
    '[2026-05-15 09:14:38] INFO  Optimizer: SGD | lr=0.01 | momentum=0.937 | weight_decay=0.0005',
    '[2026-05-15 09:14:39] INFO  Scheduler: CosineAnnealingLR | T_max=300',
    '[2026-05-15 09:14:40] INFO  Batch size: 64 (16 per GPU)',
    '[2026-05-15 09:14:41] INFO  Starting epoch 1/300...',
    '[2026-05-15 09:18:02] INFO  Epoch 1/300 | Loss: 2.4312 | mAP50: 0.0234 | LR: 0.01000',
    '[2026-05-15 09:21:23] INFO  Epoch 2/300 | Loss: 2.1847 | mAP50: 0.0512 | LR: 0.00997',
    '[2026-05-15 09:24:44] INFO  Epoch 3/300 | Loss: 1.9234 | mAP50: 0.0891 | LR: 0.00993',
    '[2026-05-15 09:28:05] INFO  Epoch 4/300 | Loss: 1.6823 | mAP50: 0.1342 | LR: 0.00989',
    '[2026-05-15 09:31:26] INFO  Epoch 5/300 | Loss: 1.4512 | mAP50: 0.1876 | LR: 0.00984',
    '[2026-05-15 09:34:47] INFO  Saving checkpoint: /checkpoints/epoch5.pt',
    '[2026-05-15 09:38:08] INFO  Epoch 6/300 | Loss: 1.2341 | mAP50: 0.2413 | LR: 0.00978',
    '[2026-05-15 09:41:29] INFO  Epoch 7/300 | Loss: 1.0876 | mAP50: 0.2987 | LR: 0.00972',
    '[2026-05-15 09:44:50] INFO  Epoch 8/300 | Loss: 0.9823 | mAP50: 0.3412 | LR: 0.00965',
    '[2026-05-15 09:48:11] WARN  GPU memory usage high: 73.8GB / 80GB',
    '[2026-05-15 09:48:11] INFO  Epoch 9/300 | Loss: 0.8934 | mAP50: 0.3876 | LR: 0.00957',
    '[2026-05-15 09:51:32] INFO  Epoch 10/300 | Loss: 0.8124 | mAP50: 0.4213 | LR: 0.00949',
  ],
  evaluate: [
    '[2026-05-15 --:--:--] INFO  Evaluate stage waiting for train completion...',
    '[2026-05-15 --:--:--] INFO  Will run: COCO mAP evaluation on val2017 (5,000 images)',
    '[2026-05-15 --:--:--] INFO  Metrics to compute: mAP@50, mAP@50:95, Precision, Recall',
  ],
  register: [
    '[2026-05-15 --:--:--] INFO  Register stage waiting for evaluate completion...',
    '[2026-05-15 --:--:--] INFO  Will push to model registry: MLflow @ http://mlflow.cluster.local',
    '[2026-05-15 --:--:--] INFO  Artifact path: s3://mlops-models/yolov8x-coco/{run_id}',
  ],
}

// ─── 하위 컴포넌트 ─────────────────────────────────────────────────────────────

// 상태 배지 컴포넌트
function StatusBadge({ status }: { status: TrainStatus }) {
  const config: Record<
    TrainStatus,
    {
      className: string
      variant: 'default' | 'secondary' | 'destructive' | 'outline'
    }
  > = {
    Running: {
      variant: 'default',
      className: 'bg-blue-500 hover:bg-blue-500 text-white border-transparent',
    },
    Succeeded: {
      variant: 'default',
      className:
        'bg-green-500 hover:bg-green-500 text-white border-transparent',
    },
    Failed: { variant: 'destructive', className: '' },
    Queued: {
      variant: 'outline',
      className: 'border-yellow-400 text-yellow-600 dark:text-yellow-400',
    },
    Canceled: { variant: 'secondary', className: 'text-muted-foreground' },
  }
  const { variant, className } = config[status]
  return (
    <Badge variant={variant} className={className}>
      {status}
    </Badge>
  )
}

// 파이프라인 단계 상태 아이콘 컴포넌트
function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2Icon className="size-5 text-green-500" />
    case 'running':
      return <LoaderCircleIcon className="size-5 animate-spin text-blue-500" />
    case 'pending':
      return <ClockIcon className="text-muted-foreground size-5" />
    case 'failed':
      return <AlertCircleIcon className="text-destructive size-5" />
  }
}

// 파이프라인 단계 카드 컴포넌트
function PipelineStepCard({
  step,
  onClick,
}: {
  step: PipelineStep
  onClick: () => void
}) {
  const stepColorClass: Record<StepStatus, string> = {
    completed: 'border-green-500/40 bg-green-500/5',
    running: 'border-blue-500/40 bg-blue-500/5 ring-2 ring-blue-500/20',
    pending: 'border-border bg-muted/30',
    failed: 'border-destructive/40 bg-destructive/5',
  }
  const labelColorClass: Record<StepStatus, string> = {
    completed: 'text-green-600 dark:text-green-400',
    running: 'text-blue-600 dark:text-blue-400',
    pending: 'text-muted-foreground',
    failed: 'text-destructive',
  }
  const statusLabel: Record<StepStatus, string> = {
    completed: '완료',
    running: '진행 중',
    pending: '대기',
    failed: '실패',
  }

  return (
    <button
      onClick={onClick}
      className={`hover:bg-accent flex min-w-[120px] cursor-pointer flex-col items-center gap-2 rounded-lg border px-4 py-3 transition-colors ${stepColorClass[step.status]}`}
      aria-label={`${step.label} 단계 로그로 이동`}
    >
      <StepIcon status={step.status} />
      <span className="text-sm font-semibold">{step.label}</span>
      <span className={`text-xs ${labelColorClass[step.status]}`}>
        {statusLabel[step.status]}
      </span>
      {step.duration && (
        <span className="text-muted-foreground text-xs">{step.duration}</span>
      )}
    </button>
  )
}

// Recharts 공통 툴팁 스타일
const tooltipStyle = {
  backgroundColor: '#1e293b',
  color: '#f1f5f9',
  border: '1px solid #334155',
  borderRadius: '6px',
  fontSize: '12px',
}

// Sparkline 컴포넌트 (리소스 카드 내 미니 차트)
function Sparkline({
  data,
  color,
}: {
  data: ResourceSnapshot[]
  color: string
}) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── 메인 페이지 컴포넌트 ──────────────────────────────────────────────────────

export default function TrainDetailPage() {
  // 로그 섹션 ref - 파이프라인 단계 클릭 시 스크롤 이동용
  const logSectionRef = useRef<HTMLDivElement>(null)

  // 활성 로그 탭 ref - 단계 클릭 시 해당 탭으로 전환
  // TODO: 실제 탭 전환 로직 구현 필요 (현재는 스크롤만 동작)
  const activeTabRef = useRef<string>('train')

  // 파이프라인 단계 클릭 핸들러 - 해당 단계 로그로 스크롤
  function handleStepClick(stepId: string) {
    // TODO: 탭 상태 관리 구현 시 activeTabRef.current = stepId 처리 연동
    activeTabRef.current = stepId
    logSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const run = dummyRun
  const isRunning = run.status === 'Running' || run.status === 'Queued'

  return (
    <div className="space-y-6 pb-12">
      {/* ── 상단 헤더 ──────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* 뒤로가기 */}
        <Link
          href="/dashboard/train"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeftIcon className="size-4" />
          Train 목록
        </Link>

        {/* 헤더 본문 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            {/* Run ID */}
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-muted-foreground bg-muted rounded px-2 py-0.5 font-mono text-sm">
                {run.runId}
              </code>
              <StatusBadge status={run.status} />
            </div>
            {/* 학습명 + 프로젝트명 */}
            <h1 className="text-2xl font-bold tracking-tight">
              {run.trainName}
            </h1>
            <p className="text-muted-foreground text-sm">{run.projectName}</p>
            {/* 메타 정보 */}
            <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
              <span>
                <span className="text-foreground font-medium">요청자</span>
                &nbsp;{run.requester}
              </span>
              <span>
                <span className="text-foreground font-medium">시작</span>&nbsp;
                {run.startedAt}
              </span>
              <span>
                <span className="text-foreground font-medium">종료</span>&nbsp;
                {run.endedAt ?? '—'}
              </span>
              <span>
                <span className="text-foreground font-medium">GPU</span>&nbsp;
                {run.gpuCount}개 · {run.trainMode}
              </span>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex shrink-0 items-center gap-2">
            {/* TODO: 재실행 API 호출 로직 구현 필요 */}
            <Button variant="outline" size="sm" onClick={() => {}}>
              <RefreshCwIcon className="mr-1.5 size-4" />
              재실행
            </Button>
            {/* Running/Queued 상태일 때만 취소 버튼 활성화 */}
            {/* TODO: 취소 API - DELETE /apis/v2beta1/runs/{runId} */}
            <Button
              variant="destructive"
              size="sm"
              disabled={!isRunning}
              onClick={() => {}}
            >
              <XCircleIcon className="mr-1.5 size-4" />
              취소
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── 1. KFP 파이프라인 단계 ────────────────────────────────── */}
      <section aria-labelledby="pipeline-heading">
        <h2 id="pipeline-heading" className="mb-4 text-base font-semibold">
          KFP 파이프라인 단계
        </h2>
        {/* 가로 스텝 레이아웃 - 화살표로 연결 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {dummySteps.map((step, idx) => (
            <div key={step.id} className="flex shrink-0 items-center gap-2">
              <PipelineStepCard
                step={step}
                onClick={() => handleStepClick(step.id)}
              />
              {/* 마지막 단계 이후 화살표 제거 */}
              {idx < dummySteps.length - 1 && (
                <div
                  className="text-muted-foreground flex items-center"
                  aria-hidden="true"
                >
                  <div className="bg-border h-px w-6" />
                  <CircleDotIcon className="size-3" />
                  <div className="bg-border h-px w-2" />
                  <span className="text-base leading-none">›</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. 학습 메트릭 차트 ───────────────────────────────────── */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="mb-4 text-base font-semibold">
          학습 메트릭
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Loss Curve */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Loss Curve</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={dummyMetrics}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    strokeOpacity={0.4}
                  />
                  <XAxis
                    dataKey="epoch"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    label={{
                      value: 'Epoch',
                      position: 'insideBottomRight',
                      offset: -4,
                      fontSize: 11,
                      fill: '#94a3b8',
                    }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                    labelFormatter={v => `Epoch ${v}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="train_loss"
                    name="Train Loss"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="val_loss"
                    name="Val Loss"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Accuracy Curve */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Accuracy Curve
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={dummyMetrics}
                  margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    strokeOpacity={0.4}
                  />
                  <XAxis
                    dataKey="epoch"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    label={{
                      value: 'Epoch',
                      position: 'insideBottomRight',
                      offset: -4,
                      fontSize: 11,
                      fill: '#94a3b8',
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    domain={[0, 1]}
                    tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                    labelFormatter={v => `Epoch ${v}`}
                    formatter={v => [`${((v as number) * 100).toFixed(2)}%`]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="train_acc"
                    name="Train Acc"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="val_acc"
                    name="Val Acc"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── 3. 리소스 사용률 ──────────────────────────────────────── */}
      <section aria-labelledby="resource-heading">
        <h2 id="resource-heading" className="mb-4 text-base font-semibold">
          리소스 사용률
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            (실시간)
          </span>
        </h2>
        {/* TODO: Prometheus polling - 5s 간격으로 데이터 갱신 필요 */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {dummyResources.map((res, idx) => {
            // 리소스 아이콘 매핑
            const icons = [
              <ActivityIcon
                key="gpu"
                className="size-4"
                style={{ color: res.color }}
              />,
              <MemoryStickIcon
                key="gmem"
                className="size-4"
                style={{ color: res.color }}
              />,
              <CpuIcon
                key="cpu"
                className="size-4"
                style={{ color: res.color }}
              />,
              <ServerIcon
                key="ram"
                className="size-4"
                style={{ color: res.color }}
              />,
            ]
            return (
              <Card key={res.label}>
                <CardContent className="px-4 pt-4 pb-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">
                      {res.label}
                    </span>
                    {icons[idx]}
                  </div>
                  {/* 현재 수치 */}
                  <div className="mb-2 flex items-baseline gap-1">
                    <span
                      className="text-xl font-bold tabular-nums"
                      style={{ color: res.color }}
                    >
                      {res.current}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {res.unit}
                    </span>
                  </div>
                  {/* Sparkline 트렌드 차트 */}
                  <Sparkline data={res.data} color={res.color} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* ── 4. 로그 뷰어 ──────────────────────────────────────────── */}
      {/* TODO: K8s Pod Logs - GET /api/v1/namespaces/{ns}/pods/{pod}/log?follow=true&tailLines=200 */}
      <section ref={logSectionRef} aria-labelledby="log-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="log-heading" className="text-base font-semibold">
            로그 뷰어
          </h2>
          {/* TODO: 로그 전체 파일 다운로드 API 연동 필요 */}
          <Button variant="outline" size="sm" onClick={() => {}}>
            <DownloadIcon className="mr-1.5 size-4" />
            로그 다운로드
          </Button>
        </div>

        <Card className="overflow-hidden">
          <Tabs defaultValue="train">
            {/* 탭 헤더 */}
            <div className="border-b px-4 pt-3">
              <TabsList className="h-8 gap-1 bg-transparent p-0">
                {dummySteps.map(step => (
                  <TabsTrigger
                    key={step.id}
                    value={step.id}
                    className="data-[state=active]:border-primary h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    <StepIcon status={step.status} />
                    <span className="ml-1.5">{step.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* 탭 컨텐츠 - 터미널 스타일 로그 */}
            {dummySteps.map(step => (
              <TabsContent key={step.id} value={step.id} className="mt-0">
                <div
                  className="overflow-y-auto bg-slate-950 font-mono text-xs leading-relaxed text-slate-100"
                  style={{ minHeight: '320px', maxHeight: '480px' }}
                  role="log"
                  aria-label={`${step.label} 단계 로그`}
                  aria-live="polite"
                >
                  <div className="space-y-0.5 p-4">
                    {dummyLogs[step.id]?.map((line, i) => {
                      // 로그 레벨에 따라 색상 지정
                      const isWarn = line.includes('WARN')
                      const isError =
                        line.includes('ERROR') || line.includes('FATAL')
                      const isSuccess =
                        line.includes('✓') || line.includes('completed')
                      const lineColor = isError
                        ? 'text-red-400'
                        : isWarn
                          ? 'text-yellow-400'
                          : isSuccess
                            ? 'text-green-400'
                            : 'text-slate-300'
                      return (
                        <div
                          key={i}
                          className={`${lineColor} break-all whitespace-pre-wrap`}
                        >
                          {line}
                        </div>
                      )
                    })}
                    {/* 진행 중인 단계는 커서 표시 */}
                    {step.status === 'running' && (
                      <div className="mt-2 flex items-center gap-1 text-blue-400">
                        <LoaderCircleIcon className="size-3 animate-spin" />
                        <span>로그 스트리밍 중...</span>
                        {/* TODO: WebSocket / SSE 로그 스트리밍 연동 필요 */}
                      </div>
                    )}
                    {/* 대기 중인 단계 안내 메시지 */}
                    {step.status === 'pending' && (
                      <div className="mt-2 text-slate-500">
                        이전 단계 완료 후 시작됩니다.
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      </section>
    </div>
  )
}
