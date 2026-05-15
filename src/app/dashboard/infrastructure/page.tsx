'use client'

// Infrastructure 페이지 - K8s 인프라 전체 현황 대시보드
// Pod / Node / GPU / Storage / Queue 상태를 탭별로 표시

import dynamic from 'next/dynamic'
import React, { useState } from 'react'

// react-syntax-highlighter: Turbopack SSR 청크 오류 우회를 위해 next/dynamic으로 클라이언트 전용 로드
const SyntaxHighlighter = dynamic(
  () => import('react-syntax-highlighter').then(mod => mod.default),
  { ssr: false }
)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedVscDarkPlus: any = null
if (typeof window !== 'undefined') {
  import('react-syntax-highlighter/dist/cjs/styles/prism').then(styles => {
    cachedVscDarkPlus = styles.vscDarkPlus
  })
}
import {
  Copy,
  Download,
  Server,
  Box,
  Cpu,
  HardDrive,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Layers,
  Users,
  Zap,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

type PodStatus = 'Running' | 'Pending' | 'Failed' | 'CrashLoopBackOff'
type NodeStatus = 'Ready' | 'NotReady'
type NodeRole = 'control-plane' | 'worker' | 'gpu-worker'
type GpuDeviceStatus = 'Available' | 'Occupied' | 'Error'
type WorkerStatus = 'Active' | 'Idle' | 'Failed'

interface PodRow {
  namespace: string
  name: string
  status: PodStatus
  restarts: number
  node: string
  cpu: string
  memory: string
  hasGpu: boolean
  age: string
  yaml: string
}

interface NodeRow {
  name: string
  status: NodeStatus
  role: NodeRole
  cpuUsage: number
  memoryUsage: number
  gpuUsage?: number
  diskPressure: boolean
  memoryPressure: boolean
  podCount: number
  yaml: string
}

interface GpuDevice {
  index: number
  utilization: number
  status: GpuDeviceStatus
}

interface GpuNode {
  nodeName: string
  gpuModel: string
  gpuCount: number
  devices: GpuDevice[]
}

interface PvcRow {
  name: string
  namespace: string
  capacity: string
  usagePercent: number
  status: string
  yaml: string
}

interface WorkerRow {
  workerId: string
  status: WorkerStatus
  currentJob: string
  throughput: string
  lastActive: string
}

// ─────────────────────────────────────────────
// 더미 데이터
// ─────────────────────────────────────────────

// TODO: K8s API - GET /api/v1/pods?fieldSelector=...
const podData: PodRow[] = [
  {
    namespace: 'mlops',
    name: 'train-job-gpt2-7f8b9',
    status: 'Running',
    restarts: 0,
    node: 'gpu-node-01',
    cpu: '2.4',
    memory: '12Gi',
    hasGpu: true,
    age: '2h',
    yaml: `apiVersion: v1
kind: Pod
metadata:
  name: train-job-gpt2-7f8b9
  namespace: mlops
  labels:
    app: train-job
    model: gpt2
spec:
  containers:
  - name: trainer
    image: registry.mlops.io/trainer:v1.2.0
    resources:
      requests:
        cpu: "2"
        memory: "12Gi"
        nvidia.com/gpu: "1"
      limits:
        cpu: "4"
        memory: "16Gi"
        nvidia.com/gpu: "1"
    env:
    - name: MODEL_NAME
      value: gpt2
    - name: EPOCHS
      value: "10"
  nodeSelector:
    accelerator: nvidia-a100
  restartPolicy: Never`,
  },
  {
    namespace: 'mlops',
    name: 'train-job-bert-3c2d1',
    status: 'Running',
    restarts: 1,
    node: 'gpu-node-02',
    cpu: '1.8',
    memory: '8Gi',
    hasGpu: true,
    age: '45m',
    yaml: `apiVersion: v1
kind: Pod
metadata:
  name: train-job-bert-3c2d1
  namespace: mlops
spec:
  containers:
  - name: trainer
    image: registry.mlops.io/trainer:v1.2.0
    resources:
      requests:
        nvidia.com/gpu: "1"`,
  },
  {
    namespace: 'serving',
    name: 'llm-api-deployment-84fd6',
    status: 'Running',
    restarts: 0,
    node: 'gpu-node-03',
    cpu: '3.1',
    memory: '20Gi',
    hasGpu: true,
    age: '3d',
    yaml: `apiVersion: v1
kind: Pod
metadata:
  name: llm-api-deployment-84fd6
  namespace: serving
  labels:
    app: llm-api
spec:
  containers:
  - name: llm-server
    image: registry.mlops.io/llm-server:v2.0.1
    ports:
    - containerPort: 8080`,
  },
  {
    namespace: 'serving',
    name: 'embedding-api-6b9c4',
    status: 'Running',
    restarts: 0,
    node: 'gpu-node-01',
    cpu: '0.8',
    memory: '4Gi',
    hasGpu: true,
    age: '5d',
    yaml: `apiVersion: v1
kind: Pod
metadata:
  name: embedding-api-6b9c4
  namespace: serving`,
  },
  {
    namespace: 'mlops',
    name: 'data-preprocess-5a1f2',
    status: 'Pending',
    restarts: 0,
    node: '-',
    cpu: '0',
    memory: '0',
    hasGpu: false,
    age: '5m',
    yaml: `apiVersion: v1
kind: Pod
metadata:
  name: data-preprocess-5a1f2
  namespace: mlops
status:
  phase: Pending
  conditions:
  - type: PodScheduled
    status: "False"
    reason: Unschedulable`,
  },
  {
    namespace: 'mlops',
    name: 'eval-run-qwen-9d3e7',
    status: 'Failed',
    restarts: 3,
    node: 'gpu-node-04',
    cpu: '0',
    memory: '0',
    hasGpu: false,
    age: '1h',
    yaml: `apiVersion: v1
kind: Pod
metadata:
  name: eval-run-qwen-9d3e7
  namespace: mlops
status:
  phase: Failed
  containerStatuses:
  - name: evaluator
    ready: false
    restartCount: 3
    state:
      terminated:
        exitCode: 1
        reason: Error`,
  },
  {
    namespace: 'monitoring',
    name: 'prometheus-0',
    status: 'Running',
    restarts: 0,
    node: 'cpu-node-01',
    cpu: '0.4',
    memory: '2Gi',
    hasGpu: false,
    age: '7d',
    yaml: `apiVersion: v1
kind: Pod
metadata:
  name: prometheus-0
  namespace: monitoring
  labels:
    app: prometheus`,
  },
  {
    namespace: 'monitoring',
    name: 'grafana-7d4bc9-xkq2p',
    status: 'Running',
    restarts: 0,
    node: 'cpu-node-01',
    cpu: '0.2',
    memory: '512Mi',
    hasGpu: false,
    age: '7d',
    yaml: `apiVersion: v1
kind: Pod
metadata:
  name: grafana-7d4bc9-xkq2p
  namespace: monitoring`,
  },
  {
    namespace: 'kube-system',
    name: 'coredns-5d78c9-m7j9p',
    status: 'Running',
    restarts: 0,
    node: 'cpu-node-02',
    cpu: '0.05',
    memory: '64Mi',
    hasGpu: false,
    age: '14d',
    yaml: `apiVersion: v1
kind: Pod
metadata:
  name: coredns-5d78c9-m7j9p
  namespace: kube-system`,
  },
  {
    namespace: 'mlops',
    name: 'feature-store-crash-2b8f1',
    status: 'CrashLoopBackOff',
    restarts: 12,
    node: 'cpu-node-02',
    cpu: '0.1',
    memory: '256Mi',
    hasGpu: false,
    age: '30m',
    yaml: `apiVersion: v1
kind: Pod
metadata:
  name: feature-store-crash-2b8f1
  namespace: mlops
status:
  phase: Running
  containerStatuses:
  - name: feature-store
    ready: false
    restartCount: 12
    state:
      waiting:
        reason: CrashLoopBackOff`,
  },
  {
    namespace: 'serving',
    name: 'rag-pipeline-9e5c3',
    status: 'Running',
    restarts: 0,
    node: 'cpu-node-01',
    cpu: '1.2',
    memory: '3Gi',
    hasGpu: false,
    age: '2d',
    yaml: `apiVersion: v1
kind: Pod
metadata:
  name: rag-pipeline-9e5c3
  namespace: serving`,
  },
]

// TODO: K8s API - GET /api/v1/nodes
const nodeData: NodeRow[] = [
  {
    name: 'gpu-node-01',
    status: 'Ready',
    role: 'gpu-worker',
    cpuUsage: 72,
    memoryUsage: 81,
    gpuUsage: 88,
    diskPressure: false,
    memoryPressure: false,
    podCount: 14,
    yaml: `apiVersion: v1
kind: Node
metadata:
  name: gpu-node-01
  labels:
    kubernetes.io/role: gpu-worker
    accelerator: nvidia-a100
spec:
  taints:
  - key: nvidia.com/gpu
    value: "true"
    effect: NoSchedule
status:
  capacity:
    cpu: "96"
    memory: 768Gi
    nvidia.com/gpu: "8"
  conditions:
  - type: Ready
    status: "True"`,
  },
  {
    name: 'gpu-node-02',
    status: 'Ready',
    role: 'gpu-worker',
    cpuUsage: 58,
    memoryUsage: 63,
    gpuUsage: 75,
    diskPressure: false,
    memoryPressure: false,
    podCount: 11,
    yaml: `apiVersion: v1
kind: Node
metadata:
  name: gpu-node-02
  labels:
    kubernetes.io/role: gpu-worker
    accelerator: nvidia-a100
status:
  capacity:
    nvidia.com/gpu: "8"
  conditions:
  - type: Ready
    status: "True"`,
  },
  {
    name: 'gpu-node-03',
    status: 'Ready',
    role: 'gpu-worker',
    cpuUsage: 45,
    memoryUsage: 55,
    gpuUsage: 60,
    diskPressure: false,
    memoryPressure: false,
    podCount: 9,
    yaml: `apiVersion: v1
kind: Node
metadata:
  name: gpu-node-03
  labels:
    accelerator: nvidia-v100
status:
  conditions:
  - type: Ready
    status: "True"`,
  },
  {
    name: 'gpu-node-04',
    status: 'NotReady',
    role: 'gpu-worker',
    cpuUsage: 12,
    memoryUsage: 18,
    gpuUsage: 0,
    diskPressure: true,
    memoryPressure: false,
    podCount: 2,
    yaml: `apiVersion: v1
kind: Node
metadata:
  name: gpu-node-04
status:
  conditions:
  - type: Ready
    status: "False"
    reason: KubeletNotReady
  - type: DiskPressure
    status: "True"`,
  },
  {
    name: 'cpu-node-01',
    status: 'Ready',
    role: 'worker',
    cpuUsage: 38,
    memoryUsage: 44,
    diskPressure: false,
    memoryPressure: false,
    podCount: 22,
    yaml: `apiVersion: v1
kind: Node
metadata:
  name: cpu-node-01
  labels:
    kubernetes.io/role: worker
status:
  capacity:
    cpu: "32"
    memory: 128Gi
  conditions:
  - type: Ready
    status: "True"`,
  },
  {
    name: 'cpu-node-02',
    status: 'Ready',
    role: 'control-plane',
    cpuUsage: 21,
    memoryUsage: 33,
    diskPressure: false,
    memoryPressure: false,
    podCount: 18,
    yaml: `apiVersion: v1
kind: Node
metadata:
  name: cpu-node-02
  labels:
    kubernetes.io/role: control-plane
status:
  capacity:
    cpu: "16"
    memory: 64Gi
  conditions:
  - type: Ready
    status: "True"`,
  },
]

// TODO: Prometheus - DCGM_FI_DEV_GPU_UTIL, DCGM_FI_DEV_GPU_TEMP
const gpuData: GpuNode[] = [
  {
    nodeName: 'gpu-node-01',
    gpuModel: 'NVIDIA A100 80GB',
    gpuCount: 8,
    devices: [
      {
        index: 0,
        utilization: 95,
        temperature: 78,
        power: 380,
        status: 'Occupied',
      },
      {
        index: 1,
        utilization: 88,
        temperature: 75,
        power: 362,
        status: 'Occupied',
      },
      {
        index: 2,
        utilization: 72,
        temperature: 71,
        power: 310,
        status: 'Occupied',
      },
      {
        index: 3,
        utilization: 0,
        temperature: 38,
        power: 45,
        status: 'Available',
      },
      {
        index: 4,
        utilization: 91,
        temperature: 80,
        power: 388,
        status: 'Occupied',
      },
      {
        index: 5,
        utilization: 87,
        temperature: 76,
        power: 358,
        status: 'Occupied',
      },
      {
        index: 6,
        utilization: 0,
        temperature: 36,
        power: 42,
        status: 'Available',
      },
      {
        index: 7,
        utilization: 99,
        temperature: 83,
        power: 400,
        status: 'Occupied',
      },
    ],
  },
  {
    nodeName: 'gpu-node-02',
    gpuModel: 'NVIDIA A100 80GB',
    gpuCount: 8,
    devices: [
      {
        index: 0,
        utilization: 80,
        temperature: 72,
        power: 340,
        status: 'Occupied',
      },
      {
        index: 1,
        utilization: 0,
        temperature: 37,
        power: 43,
        status: 'Available',
      },
      {
        index: 2,
        utilization: 76,
        temperature: 70,
        power: 325,
        status: 'Occupied',
      },
      {
        index: 3,
        utilization: 82,
        temperature: 73,
        power: 345,
        status: 'Occupied',
      },
      {
        index: 4,
        utilization: 0,
        temperature: 35,
        power: 40,
        status: 'Available',
      },
      {
        index: 5,
        utilization: 68,
        temperature: 68,
        power: 295,
        status: 'Occupied',
      },
      {
        index: 6,
        utilization: 77,
        temperature: 71,
        power: 330,
        status: 'Occupied',
      },
      {
        index: 7,
        utilization: 0,
        temperature: 36,
        power: 41,
        status: 'Available',
      },
    ],
  },
  {
    nodeName: 'gpu-node-03',
    gpuModel: 'NVIDIA V100 32GB',
    gpuCount: 4,
    devices: [
      {
        index: 0,
        utilization: 65,
        temperature: 68,
        power: 220,
        status: 'Occupied',
      },
      {
        index: 1,
        utilization: 58,
        temperature: 65,
        power: 205,
        status: 'Occupied',
      },
      {
        index: 2,
        utilization: 0,
        temperature: 34,
        power: 35,
        status: 'Available',
      },
      {
        index: 3,
        utilization: 0,
        temperature: 33,
        power: 34,
        status: 'Available',
      },
    ],
  },
  {
    nodeName: 'gpu-node-04',
    gpuModel: 'NVIDIA V100 32GB',
    gpuCount: 4,
    devices: [
      { index: 0, utilization: 0, status: 'Error' },
      { index: 1, utilization: 0, status: 'Error' },
      { index: 2, utilization: 0, status: 'Error' },
      { index: 3, utilization: 0, status: 'Error' },
    ],
  },
]

// 스토리지 도넛 차트용 더미 데이터
const storageBreakdown = [
  { label: 'Dataset', used: 18.4, color: 'bg-blue-500' },
  { label: 'Model', used: 12.7, color: 'bg-violet-500' },
  { label: 'Artifacts', used: 6.2, color: 'bg-amber-500' },
  { label: 'Logs', used: 3.1, color: 'bg-emerald-500' },
]

const pvcData: PvcRow[] = [
  {
    name: 'dataset-store-pvc',
    namespace: 'mlops',
    capacity: '50Ti',
    usagePercent: 77,
    status: 'Bound',
    yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: dataset-store-pvc
  namespace: mlops
spec:
  accessModes:
  - ReadWriteMany
  resources:
    requests:
      storage: 50Ti
  storageClassName: ceph-rbd
status:
  phase: Bound
  capacity:
    storage: 50Ti`,
  },
  {
    name: 'model-registry-pvc',
    namespace: 'mlops',
    capacity: '20Ti',
    usagePercent: 63,
    status: 'Bound',
    yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: model-registry-pvc
  namespace: mlops
spec:
  accessModes:
  - ReadWriteMany
  resources:
    requests:
      storage: 20Ti
  storageClassName: ceph-rbd
status:
  phase: Bound`,
  },
  {
    name: 'artifact-store-pvc',
    namespace: 'mlops',
    capacity: '10Ti',
    usagePercent: 62,
    status: 'Bound',
    yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: artifact-store-pvc
  namespace: mlops
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 10Ti
status:
  phase: Bound`,
  },
  {
    name: 'log-archive-pvc',
    namespace: 'monitoring',
    capacity: '5Ti',
    usagePercent: 62,
    status: 'Bound',
    yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: log-archive-pvc
  namespace: monitoring
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 5Ti
status:
  phase: Bound`,
  },
  {
    name: 'prometheus-data-pvc',
    namespace: 'monitoring',
    capacity: '500Gi',
    usagePercent: 41,
    status: 'Bound',
    yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: prometheus-data-pvc
  namespace: monitoring
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 500Gi
status:
  phase: Bound`,
  },
  {
    name: 'pending-nfs-pvc',
    namespace: 'serving',
    capacity: '2Ti',
    usagePercent: 0,
    status: 'Pending',
    yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pending-nfs-pvc
  namespace: serving
spec:
  accessModes:
  - ReadWriteMany
  resources:
    requests:
      storage: 2Ti
  storageClassName: nfs-client
status:
  phase: Pending`,
  },
]

const workerData: WorkerRow[] = [
  {
    workerId: 'worker-a1b2c3',
    status: 'Active',
    currentJob: 'train-gpt2-epoch-7',
    throughput: '124 steps/min',
    lastActive: '방금 전',
  },
  {
    workerId: 'worker-d4e5f6',
    status: 'Active',
    currentJob: 'eval-bert-v2',
    throughput: '89 steps/min',
    lastActive: '12초 전',
  },
  {
    workerId: 'worker-g7h8i9',
    status: 'Idle',
    currentJob: '-',
    throughput: '-',
    lastActive: '3분 전',
  },
  {
    workerId: 'worker-j1k2l3',
    status: 'Active',
    currentJob: 'preprocess-wiki-v3',
    throughput: '1,240 samples/s',
    lastActive: '방금 전',
  },
  {
    workerId: 'worker-m4n5o6',
    status: 'Failed',
    currentJob: 'train-llama-oom',
    throughput: '-',
    lastActive: '47분 전',
  },
  {
    workerId: 'worker-p7q8r9',
    status: 'Idle',
    currentJob: '-',
    throughput: '-',
    lastActive: '8분 전',
  },
]

// ─────────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────────

// Pod 상태에 따른 배지 스타일 반환
function getPodStatusBadge(status: PodStatus) {
  switch (status) {
    case 'Running':
      return (
        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          {status}
        </Badge>
      )
    case 'Pending':
      return (
        <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">
          {status}
        </Badge>
      )
    case 'Failed':
      return (
        <Badge className="border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400">
          {status}
        </Badge>
      )
    case 'CrashLoopBackOff':
      return (
        <Badge className="border-purple-500/30 bg-purple-500/15 text-purple-600 dark:text-purple-400">
          {status}
        </Badge>
      )
  }
}

// Node 상태 배지 반환
function getNodeStatusBadge(status: NodeStatus) {
  return status === 'Ready' ? (
    <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
      Ready
    </Badge>
  ) : (
    <Badge className="border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400">
      NotReady
    </Badge>
  )
}

// Node Role 배지 반환
function getNodeRoleBadge(role: NodeRole) {
  switch (role) {
    case 'control-plane':
      return (
        <Badge variant="outline" className="font-mono text-xs">
          control-plane
        </Badge>
      )
    case 'gpu-worker':
      return (
        <Badge variant="secondary" className="font-mono text-xs">
          gpu-worker
        </Badge>
      )
    case 'worker':
      return (
        <Badge variant="outline" className="font-mono text-xs">
          worker
        </Badge>
      )
  }
}

// GPU 디바이스 상태 배지 반환
function getGpuStatusBadge(status: GpuDeviceStatus) {
  switch (status) {
    case 'Available':
      return (
        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          Available
        </Badge>
      )
    case 'Occupied':
      return (
        <Badge className="border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400">
          Occupied
        </Badge>
      )
    case 'Error':
      return (
        <Badge className="border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400">
          Error
        </Badge>
      )
  }
}

// Worker 상태 배지 반환
function getWorkerStatusBadge(status: WorkerStatus) {
  switch (status) {
    case 'Active':
      return (
        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          Active
        </Badge>
      )
    case 'Idle':
      return (
        <Badge className="border-slate-400/30 bg-slate-400/10 text-slate-500 dark:text-slate-400">
          Idle
        </Badge>
      )
    case 'Failed':
      return (
        <Badge className="border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400">
          Failed
        </Badge>
      )
  }
}

// CPU 사용률에 따른 progress bar 색상
function getCpuProgressClass(value: number) {
  if (value >= 80) return '[&>[data-slot=progress-indicator]]:bg-red-500'
  if (value >= 60) return '[&>[data-slot=progress-indicator]]:bg-amber-500'
  return '[&>[data-slot=progress-indicator]]:bg-emerald-500'
}

// 메모리 사용률에 따른 progress bar 색상
function getMemProgressClass(value: number) {
  if (value >= 85) return '[&>[data-slot=progress-indicator]]:bg-red-500'
  if (value >= 65) return '[&>[data-slot=progress-indicator]]:bg-amber-500'
  return '[&>[data-slot=progress-indicator]]:bg-blue-500'
}

// GPU 사용률에 따른 progress bar 색상
function getGpuProgressClass(value: number) {
  if (value >= 90) return '[&>[data-slot=progress-indicator]]:bg-violet-500'
  if (value >= 60) return '[&>[data-slot=progress-indicator]]:bg-blue-500'
  return '[&>[data-slot=progress-indicator]]:bg-slate-400'
}

// ─────────────────────────────────────────────
// YAML 뷰어 모달 컴포넌트
// ─────────────────────────────────────────────

interface YamlViewerModalProps {
  open: boolean
  onClose: () => void
  title: string
  yaml: string
}

function YamlViewerModal({ open, onClose, title, yaml }: YamlViewerModalProps) {
  // TODO: 클립보드 복사 기능 구현 필요
  const handleCopy = () => {}

  // TODO: 파일 다운로드 기능 구현 필요
  const handleDownload = () => {}

  // vscDarkPlus 스타일 상태 관리 (동적 로드)
  const [style, setStyle] = useState<Record<
    string,
    React.CSSProperties
  > | null>(null)

  // 모달이 열릴 때 스타일 로드
  React.useEffect(() => {
    if (open && !style) {
      if (cachedVscDarkPlus) {
        setStyle(cachedVscDarkPlus)
      } else {
        import('react-syntax-highlighter/dist/cjs/styles/prism').then(m => {
          cachedVscDarkPlus = m.vscDarkPlus
          setStyle(m.vscDarkPlus)
        })
      }
    }
  }, [open, style])

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="font-mono text-sm">{title}</DialogTitle>
        </DialogHeader>

        {/* YAML 코드 영역 */}
        <div className="max-h-[calc(80vh-120px)] overflow-y-auto bg-[#0f172a]">
          {SyntaxHighlighter && style ? (
            <SyntaxHighlighter
              language="yaml"
              style={style}
              customStyle={{
                margin: 0,
                borderRadius: 0,
                fontSize: '0.8rem',
                background: '#0f172a',
              }}
              showLineNumbers
            >
              {yaml}
            </SyntaxHighlighter>
          ) : (
            // 로딩 중 fallback - 코드를 plain text로 표시
            <pre className="p-4 font-mono text-xs leading-relaxed text-slate-300">
              {yaml}
            </pre>
          )}
        </div>

        {/* 액션 버튼 영역 */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5"
          >
            <Copy className="size-3.5" />
            {/* TODO: 복사 완료 피드백 */}
            복사
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="gap-1.5"
          >
            <Download className="size-3.5" />
            {/* TODO: 다운로드 파일명 설정 */}
            다운로드
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────
// 상단 요약 카드
// ─────────────────────────────────────────────

function SummaryCards() {
  const totalNodes = nodeData.length
  const readyNodes = nodeData.filter(n => n.status === 'Ready').length
  const notReadyNodes = totalNodes - readyNodes

  const totalPods = podData.length
  const runningPods = podData.filter(p => p.status === 'Running').length
  const failedPods = podData.filter(
    p => p.status === 'Failed' || p.status === 'CrashLoopBackOff'
  ).length

  const gpuNodes = nodeData.filter(n => n.gpuUsage !== undefined).length
  const activeGpuNodes = nodeData.filter(
    n => n.gpuUsage !== undefined && n.gpuUsage > 0
  ).length

  // 스토리지 총 사용량
  const totalUsedTb = storageBreakdown.reduce((sum, s) => sum + s.used, 0)
  const totalCapacityTb = 85.5
  const storagePercent = Math.round((totalUsedTb / totalCapacityTb) * 100)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* 노드 카드 */}
      <Card className="gap-3 py-4">
        <CardHeader className="px-5 pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              전체 노드
            </CardTitle>
            <Server className="text-muted-foreground size-4" />
          </div>
        </CardHeader>
        <CardContent className="px-5">
          <p className="text-3xl font-bold">{totalNodes}</p>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="size-3.5" />
              Ready {readyNodes}
            </span>
            <span className="flex items-center gap-1 text-red-500">
              <XCircle className="size-3.5" />
              NotReady {notReadyNodes}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Pod 카드 */}
      <Card className="gap-3 py-4">
        <CardHeader className="px-5 pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              전체 Pod
            </CardTitle>
            <Box className="text-muted-foreground size-4" />
          </div>
        </CardHeader>
        <CardContent className="px-5">
          <p className="text-3xl font-bold">{totalPods}</p>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Activity className="size-3.5" />
              Running {runningPods}
            </span>
            <span className="flex items-center gap-1 text-red-500">
              <XCircle className="size-3.5" />
              Failed {failedPods}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* GPU 카드 */}
      <Card className="gap-3 py-4">
        <CardHeader className="px-5 pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              GPU 노드
            </CardTitle>
            <Cpu className="text-muted-foreground size-4" />
          </div>
        </CardHeader>
        <CardContent className="px-5">
          <p className="text-3xl font-bold">{gpuNodes}</p>
          <div className="mt-2 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <Zap className="size-3.5" />
              사용 중 {activeGpuNodes}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 스토리지 카드 */}
      <Card className="gap-3 py-4">
        <CardHeader className="px-5 pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              스토리지 사용률
            </CardTitle>
            <HardDrive className="text-muted-foreground size-4" />
          </div>
        </CardHeader>
        <CardContent className="px-5">
          <p className="text-3xl font-bold">{storagePercent}%</p>
          <div className="mt-2 space-y-1">
            <Progress
              value={storagePercent}
              className={`h-1.5 ${storagePercent >= 80 ? '[&>[data-slot=progress-indicator]]:bg-amber-500' : '[&>[data-slot=progress-indicator]]:bg-blue-500'}`}
            />
            <p className="text-muted-foreground text-xs">
              {totalUsedTb.toFixed(1)} TB / {totalCapacityTb} TB
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────
// Pod 탭 컨텐츠
// ─────────────────────────────────────────────

function PodTab() {
  const [selectedYaml, setSelectedYaml] = useState<{
    title: string
    yaml: string
  } | null>(null)

  return (
    <>
      {/* TODO: K8s API - GET /api/v1/pods?fieldSelector=... */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold">Namespace</TableHead>
              <TableHead className="font-semibold">Pod Name</TableHead>
              <TableHead className="font-semibold">상태</TableHead>
              <TableHead className="font-semibold">Restarts</TableHead>
              <TableHead className="font-semibold">Node</TableHead>
              <TableHead className="font-semibold">CPU (cores)</TableHead>
              <TableHead className="font-semibold">Memory</TableHead>
              <TableHead className="font-semibold">GPU</TableHead>
              <TableHead className="font-semibold">Age</TableHead>
              <TableHead className="font-semibold"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {podData.map(pod => (
              <TableRow key={pod.name} className="hover:bg-muted/30">
                {/* 네임스페이스 */}
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {pod.namespace}
                </TableCell>

                {/* Pod 이름 */}
                <TableCell className="max-w-[180px] truncate font-mono text-xs font-medium">
                  {pod.name}
                </TableCell>

                {/* 상태 배지 */}
                <TableCell>{getPodStatusBadge(pod.status)}</TableCell>

                {/* Restart 수 - 5 이상이면 빨간색 */}
                <TableCell
                  className={
                    pod.restarts >= 5
                      ? 'font-bold text-red-500'
                      : 'text-foreground'
                  }
                >
                  {pod.restarts}
                </TableCell>

                {/* 노드명 */}
                <TableCell className="font-mono text-xs">{pod.node}</TableCell>

                {/* CPU */}
                <TableCell className="text-sm">{pod.cpu}</TableCell>

                {/* Memory */}
                <TableCell className="text-sm">{pod.memory}</TableCell>

                {/* GPU 여부 */}
                <TableCell>
                  {pod.hasGpu && (
                    <Badge className="border-violet-500/30 bg-violet-500/15 text-violet-600 dark:text-violet-400">
                      GPU
                    </Badge>
                  )}
                </TableCell>

                {/* Age */}
                <TableCell className="text-muted-foreground text-sm">
                  {pod.age}
                </TableCell>

                {/* YAML 버튼 */}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      setSelectedYaml({ title: pod.name, yaml: pod.yaml })
                    }
                  >
                    YAML
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* YAML 뷰어 모달 */}
      {selectedYaml && (
        <YamlViewerModal
          open={!!selectedYaml}
          onClose={() => setSelectedYaml(null)}
          title={selectedYaml.title}
          yaml={selectedYaml.yaml}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────
// Node 탭 컨텐츠
// ─────────────────────────────────────────────

function NodeTab() {
  const [selectedYaml, setSelectedYaml] = useState<{
    title: string
    yaml: string
  } | null>(null)

  return (
    <>
      {/* TODO: K8s API - GET /api/v1/nodes */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold">Node Name</TableHead>
              <TableHead className="font-semibold">상태</TableHead>
              <TableHead className="font-semibold">Role</TableHead>
              <TableHead className="w-40 font-semibold">CPU 사용률</TableHead>
              <TableHead className="w-40 font-semibold">
                Memory 사용률
              </TableHead>
              <TableHead className="w-36 font-semibold">GPU 사용률</TableHead>
              <TableHead className="font-semibold">Disk Pressure</TableHead>
              <TableHead className="font-semibold">Mem Pressure</TableHead>
              <TableHead className="font-semibold">Pods</TableHead>
              <TableHead className="font-semibold"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nodeData.map(node => (
              <TableRow key={node.name} className="hover:bg-muted/30">
                {/* 노드명 */}
                <TableCell className="font-mono text-sm font-medium">
                  {node.name}
                </TableCell>

                {/* 상태 */}
                <TableCell>{getNodeStatusBadge(node.status)}</TableCell>

                {/* Role */}
                <TableCell>{getNodeRoleBadge(node.role)}</TableCell>

                {/* CPU progress bar */}
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">CPU</span>
                      <span
                        className={
                          node.cpuUsage >= 80
                            ? 'font-medium text-red-500'
                            : 'text-muted-foreground'
                        }
                      >
                        {node.cpuUsage}%
                      </span>
                    </div>
                    <Progress
                      value={node.cpuUsage}
                      className={`h-1.5 ${getCpuProgressClass(node.cpuUsage)}`}
                    />
                  </div>
                </TableCell>

                {/* Memory progress bar */}
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">MEM</span>
                      <span
                        className={
                          node.memoryUsage >= 85
                            ? 'font-medium text-red-500'
                            : 'text-muted-foreground'
                        }
                      >
                        {node.memoryUsage}%
                      </span>
                    </div>
                    <Progress
                      value={node.memoryUsage}
                      className={`h-1.5 ${getMemProgressClass(node.memoryUsage)}`}
                    />
                  </div>
                </TableCell>

                {/* GPU progress bar (GPU 노드만) */}
                <TableCell>
                  {node.gpuUsage !== undefined ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">GPU</span>
                        <span
                          className={
                            node.gpuUsage >= 90
                              ? 'font-medium text-violet-500'
                              : 'text-muted-foreground'
                          }
                        >
                          {node.gpuUsage}%
                        </span>
                      </div>
                      <Progress
                        value={node.gpuUsage}
                        className={`h-1.5 ${getGpuProgressClass(node.gpuUsage)}`}
                      />
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">-</span>
                  )}
                </TableCell>

                {/* Disk Pressure */}
                <TableCell>
                  {node.diskPressure ? (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="size-3.5" />
                      경고
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="size-3.5" />
                      정상
                    </span>
                  )}
                </TableCell>

                {/* Memory Pressure */}
                <TableCell>
                  {node.memoryPressure ? (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="size-3.5" />
                      경고
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="size-3.5" />
                      정상
                    </span>
                  )}
                </TableCell>

                {/* Pod 수 */}
                <TableCell className="text-sm">{node.podCount}</TableCell>

                {/* YAML 버튼 */}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      setSelectedYaml({ title: node.name, yaml: node.yaml })
                    }
                  >
                    YAML
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedYaml && (
        <YamlViewerModal
          open={!!selectedYaml}
          onClose={() => setSelectedYaml(null)}
          title={selectedYaml.title}
          yaml={selectedYaml.yaml}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────
// GPU 탭 컨텐츠
// ─────────────────────────────────────────────

function GpuTab() {
  return (
    // TODO: Prometheus - DCGM_FI_DEV_GPU_UTIL, DCGM_FI_DEV_GPU_TEMP
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {gpuData.map(gpuNode => (
        <Card key={gpuNode.nodeName} className="gap-4 py-4">
          <CardHeader className="px-5 pb-0">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="font-mono text-sm">
                  {gpuNode.nodeName}
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  {gpuNode.gpuModel} &times; {gpuNode.gpuCount}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">
                {gpuNode.gpuCount} GPUs
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="px-5">
            <div className="space-y-3">
              {gpuNode.devices.map(device => (
                <div
                  key={device.index}
                  className="bg-muted/20 rounded-lg border p-3"
                >
                  {/* GPU 헤더 행 */}
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-mono text-xs font-medium">
                      GPU {device.index}
                    </span>
                    <div className="flex items-center gap-2">
                      {getGpuStatusBadge(device.status)}
                    </div>
                  </div>

                  {/* 사용률 progress bar */}
                  <div className="flex items-center gap-2">
                    <Progress
                      value={device.utilization}
                      className={`h-2 flex-1 ${getGpuProgressClass(device.utilization)}`}
                    />
                    <span className="text-muted-foreground w-9 text-right text-xs tabular-nums">
                      {device.utilization}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────
// 스토리지 탭 컨텐츠
// ─────────────────────────────────────────────

function StorageTab() {
  const [selectedYaml, setSelectedYaml] = useState<{
    title: string
    yaml: string
  } | null>(null)

  const totalUsed = storageBreakdown.reduce((sum, s) => sum + s.used, 0)
  const totalCapacity = 85.5

  return (
    <div className="space-y-6">
      {/* 스토리지 사용량 요약 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 도넛 차트 대체 - 레이아웃으로 표현 */}
        <Card className="gap-4 py-5">
          <CardHeader className="px-5 pb-0">
            <CardTitle className="text-sm">전체 스토리지 사용량</CardTitle>
            <CardDescription className="text-xs">
              {totalUsed.toFixed(1)} TB / {totalCapacity} TB 사용 중
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            {/* 누적 bar로 도넛 차트 대체 표현 */}
            <div className="mb-4 flex h-6 w-full overflow-hidden rounded-full">
              {storageBreakdown.map(item => (
                <div
                  key={item.label}
                  className={`${item.color} transition-all`}
                  style={{ width: `${(item.used / totalCapacity) * 100}%` }}
                  title={`${item.label}: ${item.used}TB`}
                />
              ))}
              {/* 잔여 용량 */}
              <div
                className="bg-muted"
                style={{
                  width: `${((totalCapacity - totalUsed) / totalCapacity) * 100}%`,
                }}
              />
            </div>

            {/* 범례 */}
            <div className="space-y-2">
              {storageBreakdown.map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`size-2.5 rounded-full ${item.color}`} />
                  <span className="text-muted-foreground flex-1 text-xs">
                    {item.label}
                  </span>
                  <span className="text-xs font-medium">{item.used} TB</span>
                  <span className="text-muted-foreground w-12 text-right text-xs">
                    {((item.used / totalCapacity) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 border-t pt-1">
                <div className="bg-muted size-2.5 rounded-full" />
                <span className="text-muted-foreground flex-1 text-xs">
                  여유 공간
                </span>
                <span className="text-xs font-medium">
                  {(totalCapacity - totalUsed).toFixed(1)} TB
                </span>
                <span className="text-muted-foreground w-12 text-right text-xs">
                  {(
                    ((totalCapacity - totalUsed) / totalCapacity) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 스토리지 클래스별 상태 카드 */}
        <Card className="gap-4 py-5">
          <CardHeader className="px-5 pb-0">
            <CardTitle className="text-sm">StorageClass 현황</CardTitle>
            <CardDescription className="text-xs">
              사용 가능한 스토리지 클래스 목록
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <div className="space-y-3">
              {[
                {
                  name: 'ceph-rbd',
                  type: 'Block',
                  total: '80Ti',
                  status: 'Active',
                },
                {
                  name: 'nfs-client',
                  type: 'NFS',
                  total: '5Ti',
                  status: 'Active',
                },
                {
                  name: 'local-ssd',
                  type: 'Local',
                  total: '500Gi',
                  status: 'Active',
                },
              ].map(sc => (
                <div
                  key={sc.name}
                  className="bg-muted/20 flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="font-mono text-xs font-medium">{sc.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {sc.type} · {sc.total}
                    </p>
                  </div>
                  <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    {sc.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PVC 목록 */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">PVC 목록</h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold">PVC 이름</TableHead>
                <TableHead className="font-semibold">Namespace</TableHead>
                <TableHead className="font-semibold">용량</TableHead>
                <TableHead className="w-48 font-semibold">사용률</TableHead>
                <TableHead className="font-semibold">상태</TableHead>
                <TableHead className="font-semibold"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pvcData.map(pvc => (
                <TableRow key={pvc.name} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs font-medium">
                    {pvc.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {pvc.namespace}
                  </TableCell>
                  <TableCell className="text-sm">{pvc.capacity}</TableCell>
                  <TableCell>
                    {pvc.status === 'Bound' ? (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">사용 중</span>
                          <span
                            className={
                              pvc.usagePercent >= 80
                                ? 'font-medium text-amber-600 dark:text-amber-400'
                                : 'text-muted-foreground'
                            }
                          >
                            {pvc.usagePercent}%
                          </span>
                        </div>
                        <Progress
                          value={pvc.usagePercent}
                          className={`h-1.5 ${
                            pvc.usagePercent >= 80
                              ? '[&>[data-slot=progress-indicator]]:bg-amber-500'
                              : '[&>[data-slot=progress-indicator]]:bg-blue-500'
                          }`}
                        />
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {pvc.status === 'Bound' ? (
                      <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        Bound
                      </Badge>
                    ) : (
                      <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        {pvc.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        setSelectedYaml({ title: pvc.name, yaml: pvc.yaml })
                      }
                    >
                      YAML
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedYaml && (
        <YamlViewerModal
          open={!!selectedYaml}
          onClose={() => setSelectedYaml(null)}
          title={selectedYaml.title}
          yaml={selectedYaml.yaml}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Queue/Worker 탭 컨텐츠
// ─────────────────────────────────────────────

function QueueTab() {
  // 큐 상태 더미 데이터
  const queueStats = {
    waiting: 7,
    processing: 3,
    failed: 2,
  }

  return (
    <div className="space-y-5">
      {/* 큐 상태 카드 3개 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="gap-3 py-4">
          <CardHeader className="px-5 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                대기 중
              </CardTitle>
              <Layers className="text-muted-foreground size-4" />
            </div>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {queueStats.waiting}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              처리 대기 중인 작업
            </p>
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-5 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                처리 중
              </CardTitle>
              <Activity className="size-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              {queueStats.processing}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              현재 실행 중인 작업
            </p>
          </CardContent>
        </Card>

        <Card className="gap-3 py-4">
          <CardHeader className="px-5 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                실패
              </CardTitle>
              <XCircle className="size-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-3xl font-bold text-red-500">
              {queueStats.failed}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              재시도 필요한 작업
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Worker 목록 테이블 */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Worker 목록</h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="font-semibold">Worker ID</TableHead>
                <TableHead className="font-semibold">상태</TableHead>
                <TableHead className="font-semibold">처리 중 Job</TableHead>
                <TableHead className="font-semibold">처리 속도</TableHead>
                <TableHead className="font-semibold">마지막 활동</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workerData.map(worker => (
                <TableRow key={worker.workerId} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs font-medium">
                    {worker.workerId}
                  </TableCell>
                  <TableCell>{getWorkerStatusBadge(worker.status)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {worker.currentJob}
                  </TableCell>
                  <TableCell className="text-sm">{worker.throughput}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {worker.lastActive}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Worker 범례 */}
        <div className="text-muted-foreground mt-3 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5" />총 {workerData.length}개 Worker
          </div>
          <span>
            Active {workerData.filter(w => w.status === 'Active').length}
          </span>
          <span>Idle {workerData.filter(w => w.status === 'Idle').length}</span>
          <span className="text-red-500">
            Failed {workerData.filter(w => w.status === 'Failed').length}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────

export default function InfrastructurePage() {
  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Infrastructure</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Pod / Node / GPU / Storage / Queue 상태
        </p>
      </div>

      {/* 상단 요약 카드 4개 */}
      <SummaryCards />

      {/* 탭 구성 */}
      <Tabs defaultValue="pod" className="space-y-4">
        <TabsList className="h-auto gap-1 p-1">
          <TabsTrigger value="pod" className="gap-1.5">
            <Box className="size-3.5" />
            Pod
          </TabsTrigger>
          <TabsTrigger value="node" className="gap-1.5">
            <Server className="size-3.5" />
            Node
          </TabsTrigger>
          <TabsTrigger value="gpu" className="gap-1.5">
            <Cpu className="size-3.5" />
            GPU
          </TabsTrigger>
          <TabsTrigger value="storage" className="gap-1.5">
            <HardDrive className="size-3.5" />
            스토리지
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-1.5">
            <Layers className="size-3.5" />
            Queue/Worker
          </TabsTrigger>
        </TabsList>

        {/* Pod 탭 */}
        <TabsContent value="pod">
          <PodTab />
        </TabsContent>

        {/* Node 탭 */}
        <TabsContent value="node">
          <NodeTab />
        </TabsContent>

        {/* GPU 탭 */}
        <TabsContent value="gpu">
          <GpuTab />
        </TabsContent>

        {/* 스토리지 탭 */}
        <TabsContent value="storage">
          <StorageTab />
        </TabsContent>

        {/* Queue/Worker 탭 */}
        <TabsContent value="queue">
          <QueueTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
