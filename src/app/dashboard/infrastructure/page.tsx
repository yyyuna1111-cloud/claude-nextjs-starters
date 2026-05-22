'use client'

// Infrastructure 페이지 - K8s 인프라 전체 현황 대시보드
// Pod / Node / GPU 상태를 탭별로 표시

import dynamic from 'next/dynamic'
import React, { useState, useEffect } from 'react'

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
  CheckCircle,
  XCircle,
  Activity,
  Layers,
  Zap,
  AlertTriangle,
  Search,
  ArrowUpDown,
  ChevronDown,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Skeleton } from '@/components/ui/skeleton'

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

type PodStatus = 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'CrashLoopBackOff' | 'Terminating' | 'Unknown'
type NodeStatus = 'Ready' | 'NotReady'
type NodeRole = 'control-plane' | 'worker' | 'gpu-worker'
type GpuDeviceStatus = 'Available' | 'Occupied' | 'Error'

interface PodRow {
  namespace: string
  name: string
  status: string
  restarts: number
  node: string
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
  temperature?: number
  power?: number
  status: GpuDeviceStatus
}

interface GpuNode {
  nodeName: string
  gpuModel: string
  gpuCount: number
  devices: GpuDevice[]
}

// ─────────────────────────────────────────────
// 풍성한 더미 데이터 (Mock)
// ─────────────────────────────────────────────

const nodeData: NodeRow[] = [
  { name: 'gpu-node-01', status: 'Ready', role: 'gpu-worker', cpuUsage: 72, memoryUsage: 81, gpuUsage: 88, diskPressure: false, memoryPressure: false, podCount: 14, yaml: '...' },
  { name: 'gpu-node-02', status: 'Ready', role: 'gpu-worker', cpuUsage: 58, memoryUsage: 63, gpuUsage: 75, diskPressure: false, memoryPressure: false, podCount: 11, yaml: '...' },
  { name: 'gpu-node-03', status: 'Ready', role: 'gpu-worker', cpuUsage: 45, memoryUsage: 55, gpuUsage: 60, diskPressure: false, memoryPressure: false, podCount: 9, yaml: '...' },
  { name: 'gpu-node-04', status: 'NotReady', role: 'gpu-worker', cpuUsage: 12, memoryUsage: 18, gpuUsage: 0, diskPressure: true, memoryPressure: false, podCount: 2, yaml: '...' },
  { name: 'cpu-node-01', status: 'Ready', role: 'worker', cpuUsage: 38, memoryUsage: 44, diskPressure: false, memoryPressure: false, podCount: 22, yaml: '...' },
  { name: 'cpu-node-02', status: 'Ready', role: 'control-plane', cpuUsage: 21, memoryUsage: 33, diskPressure: false, memoryPressure: false, podCount: 18, yaml: '...' },
]

const gpuData: GpuNode[] = [
  {
    nodeName: 'gpu-node-01',
    gpuModel: 'NVIDIA A100 80GB',
    gpuCount: 8,
    devices: [
      { index: 0, utilization: 95, temperature: 78, power: 380, status: 'Occupied' },
      { index: 1, utilization: 88, temperature: 75, power: 362, status: 'Occupied' },
      { index: 2, utilization: 72, temperature: 71, power: 310, status: 'Occupied' },
      { index: 3, utilization: 0, temperature: 38, power: 45, status: 'Available' },
      { index: 4, utilization: 91, temperature: 80, power: 388, status: 'Occupied' },
      { index: 5, utilization: 87, temperature: 76, power: 358, status: 'Occupied' },
      { index: 6, utilization: 0, temperature: 36, power: 42, status: 'Available' },
      { index: 7, utilization: 99, temperature: 83, power: 400, status: 'Occupied' },
    ],
  },
  {
    nodeName: 'gpu-node-02',
    gpuModel: 'NVIDIA A100 80GB',
    gpuCount: 8,
    devices: [
      { index: 0, utilization: 80, temperature: 72, power: 340, status: 'Occupied' },
      { index: 1, utilization: 0, temperature: 37, power: 43, status: 'Available' },
      { index: 2, utilization: 76, temperature: 70, power: 325, status: 'Occupied' },
      { index: 3, utilization: 82, temperature: 73, power: 345, status: 'Occupied' },
      { index: 4, utilization: 0, temperature: 35, power: 40, status: 'Available' },
      { index: 5, utilization: 68, temperature: 68, power: 295, status: 'Occupied' },
      { index: 6, utilization: 77, temperature: 71, power: 330, status: 'Occupied' },
      { index: 7, utilization: 0, temperature: 36, power: 41, status: 'Available' },
    ],
  },
  {
    nodeName: 'gpu-node-03',
    gpuModel: 'NVIDIA V100 32GB',
    gpuCount: 4,
    devices: [
      { index: 0, utilization: 65, temperature: 68, power: 220, status: 'Occupied' },
      { index: 1, utilization: 58, temperature: 65, power: 205, status: 'Occupied' },
      { index: 2, utilization: 0, temperature: 34, power: 35, status: 'Available' },
      { index: 3, utilization: 0, temperature: 33, power: 34, status: 'Available' },
    ],
  },
]

// ─────────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────────

function getPodStatusBadge(status: string) {
  switch (status) {
    case 'Running': return <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold tracking-tight">{status}</Badge>
    case 'Pending': return <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold tracking-tight">{status}</Badge>
    case 'Failed': return <Badge className="border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400 font-bold tracking-tight">{status}</Badge>
    case 'Succeeded': return <Badge className="border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold tracking-tight">Completed</Badge>
    case 'CrashLoopBackOff': return <Badge className="border-purple-500/30 bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold tracking-tight">{status}</Badge>
    case 'Terminating': return <Badge className="border-slate-500/30 bg-slate-500/15 text-slate-600 dark:text-slate-400 font-bold tracking-tight">{status}</Badge>
    default: return <Badge className="border-muted/30 bg-muted/15 text-muted-foreground font-bold tracking-tight">{status}</Badge>
  }
}

function getNodeStatusBadge(status: NodeStatus) {
  return status === 'Ready' 
    ? <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold tracking-tight uppercase">Ready</Badge>
    : <Badge className="border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400 font-bold tracking-tight uppercase">NotReady</Badge>
}

function getNodeRoleBadge(role: NodeRole) {
  return <Badge variant="outline" className="font-bold text-[9px] uppercase tracking-tighter border-muted-foreground/30">{role}</Badge>
}

function getGpuStatusBadge(status: GpuDeviceStatus) {
  switch (status) {
    case 'Available': return <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[9px] tracking-widest px-1.5 h-4">AVAIL</Badge>
    case 'Occupied': return <Badge className="border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold text-[9px] tracking-widest px-1.5 h-4">BUSY</Badge>
    case 'Error': return <Badge className="border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400 font-bold text-[9px] tracking-widest px-1.5 h-4">ERR</Badge>
  }
}

function getCpuProgressClass(v: number) {
  if (v >= 80) return '[&>[data-slot=progress-indicator]]:bg-red-500'
  if (v >= 60) return '[&>[data-slot=progress-indicator]]:bg-amber-500'
  return '[&>[data-slot=progress-indicator]]:bg-emerald-500'
}

function getMemProgressClass(v: number) {
  if (v >= 85) return '[&>[data-slot=progress-indicator]]:bg-red-500'
  if (v >= 65) return '[&>[data-slot=progress-indicator]]:bg-amber-500'
  return '[&>[data-slot=progress-indicator]]:bg-blue-500'
}

function getGpuProgressClass(v: number) {
  if (v >= 90) return '[&>[data-slot=progress-indicator]]:bg-violet-500'
  if (v >= 60) return '[&>[data-slot=progress-indicator]]:bg-blue-500'
  return '[&>[data-slot=progress-indicator]]:bg-slate-400'
}

// ─────────────────────────────────────────────
// YAML 뷰어 모달
// ─────────────────────────────────────────────

interface YamlViewerModalProps {
  open: boolean
  onClose: () => void
  title: string
  yaml: string
}

function YamlViewerModal({ open, onClose, title, yaml }: YamlViewerModalProps) {
  const [style, setStyle] = useState<Record<string, React.CSSProperties> | null>(null)
  useEffect(() => {
    if (open && !style) {
      if (cachedVscDarkPlus) setStyle(cachedVscDarkPlus)
      else import('react-syntax-highlighter/dist/cjs/styles/prism').then(m => {
        cachedVscDarkPlus = m.vscDarkPlus
        setStyle(m.vscDarkPlus)
      })
    }
  }, [open, style])

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-hidden p-0 border-none ring-1 ring-border shadow-2xl">
        <DialogHeader className="border-b px-6 py-4 bg-muted/20">
          <DialogTitle className="font-mono text-sm flex items-center gap-2 font-bold uppercase">
             <Layers className="size-4 text-primary" />
             {title}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[calc(80vh-120px)] overflow-y-auto bg-[#0f172a]">
          {SyntaxHighlighter && style ? (
            <SyntaxHighlighter language="yaml" style={style} customStyle={{ margin: 0, borderRadius: 0, fontSize: '0.75rem', background: '#0f172a', padding: '1.5rem' }} showLineNumbers>
              {yaml}
            </SyntaxHighlighter>
          ) : <pre className="p-6 font-mono text-xs leading-relaxed text-slate-300">{yaml}</pre>}
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-6 py-3 bg-muted/10">
          <Button variant="outline" size="sm" onClick={() => {}} className="gap-1.5 h-8 text-[10px] font-bold uppercase tracking-widest"><Copy className="size-3" />COPY</Button>
          <Button variant="outline" size="sm" onClick={() => {}} className="gap-1.5 h-8 text-[10px] font-bold uppercase tracking-widest"><Download className="size-3" />DOWNLOAD</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────
// 메인 인프라 컴포넌트
// ─────────────────────────────────────────────

export default function InfrastructurePage() {
  const [selectedYaml, setSelectedYaml] = useState<{ title: string; yaml: string } | null>(null)
  const [nodesLoading, setNodesLoading] = useState(true)
  const [nodesSummary, setNodesSummary] = useState<{
    totalCount: number
    readyCount: number
    notReadyCount: number
  } | null>(null)

  const [podsLoading, setPodsLoading] = useState(true)
  const [podsSummary, setPodsSummary] = useState<{
    totalCount: number
    runningCount: number
    pendingCount: number
    completedCount: number
    failedCount: number
    crashLoopCount: number
    otherCount: number
    pods: PodRow[]
  } | null>(null)

  // 정렬 및 필터링 상태
  const [podSearch, setPodSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortConfig, setSortConfig] = useState<{ key: keyof PodRow; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  })
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  // 필터 변경 시 페이지 초기화
  useEffect(() => {
    setCurrentPage(1)
  }, [podSearch, statusFilter])

  const fetchNodes = async () => {
    setNodesLoading(true)
    try {
      const res = await fetch('/api/k8s/nodes')
      if (!res.ok) throw new Error('API Response Error')
      const json = await res.json()
      setNodesSummary({
        totalCount: json.totalCount,
        readyCount: json.readyCount,
        notReadyCount: json.notReadyCount
      })
    } catch (err) {
      console.error('[Infrastructure] Fetch Nodes Error:', err)
      setNodesSummary({ totalCount: 0, readyCount: 0, notReadyCount: 0 })
    } finally {
      setNodesLoading(false)
    }
  }

  const fetchPods = async () => {
    setPodsLoading(true)
    try {
      const res = await fetch('/api/k8s/pods')
      if (!res.ok) throw new Error('API Response Error')
      const json = await res.json()
      setPodsSummary({
        totalCount: json.totalCount,
        runningCount: json.runningCount,
        pendingCount: json.pendingCount,
        completedCount: json.completedCount,
        failedCount: json.failedCount,
        crashLoopCount: json.crashLoopCount,
        otherCount: json.otherCount || 0,
        pods: json.pods || []
      })
    } catch (err) {
      console.error('[Infrastructure] Fetch Pods Error:', err)
      setPodsSummary({ totalCount: 0, runningCount: 0, pendingCount: 0, completedCount: 0, failedCount: 0, crashLoopCount: 0, otherCount: 0, pods: [] })
    } finally {
      setPodsLoading(false)
    }
  }

  useEffect(() => {
    fetchNodes()
    fetchPods()
  }, [])

  // Pod 필터링 및 정렬 로직
  const filteredAndSortedPods = React.useMemo(() => {
    if (!podsSummary?.pods) return []

    let result = [...podsSummary.pods]

    // 1. 검색 필터 (이름 또는 네임스페이스)
    if (podSearch) {
      const lowerSearch = podSearch.toLowerCase()
      result = result.filter(
        p => p.name.toLowerCase().includes(lowerSearch) || p.namespace.toLowerCase().includes(lowerSearch)
      )
    }

    // 2. 상태 필터
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter)
    }

    // 3. 정렬
    result.sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [podsSummary?.pods, podSearch, statusFilter, sortConfig])

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredAndSortedPods.length / ITEMS_PER_PAGE)
  const paginatedPods = filteredAndSortedPods.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const toggleSort = (key: keyof PodRow) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  // GPU 평균 사용률 계산
  const allGpuDevices = gpuData.flatMap(n => n.devices)
  const avgGpuUtilization = allGpuDevices.length > 0
    ? Math.round(allGpuDevices.reduce((sum, dev) => sum + dev.utilization, 0) / allGpuDevices.length)
    : 0
  const busyGpuCount = allGpuDevices.filter(d => d.status === 'Occupied').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Infrastructure</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Cluster Resource & GPU Utilization
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* 노드 요약 */}
        <Card className="gap-3 py-4 shadow-sm border-none ring-1 ring-border overflow-hidden group hover:ring-primary/40 transition-all">
          <CardHeader className="px-5 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Total Nodes</CardTitle>
              <Server className="text-muted-foreground size-4 group-hover:text-primary transition-colors" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pt-1">
            <div className="text-4xl font-bold tracking-tighter">
              {nodesLoading ? <Skeleton className="h-10 w-16" /> : nodesSummary?.totalCount}
            </div>
            <div className="mt-2 flex items-center gap-3 text-[10px] font-bold uppercase tabular-nums">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="size-3" /> RDY {nodesLoading ? '...' : nodesSummary?.readyCount}
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <XCircle className="size-3" /> ERR {nodesLoading ? '...' : nodesSummary?.notReadyCount}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Pod 요약 */}
        <Card className="gap-3 py-4 shadow-sm border-none ring-1 ring-border overflow-hidden group hover:ring-primary/40 transition-all">
          <CardHeader className="px-5 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Total Pods</CardTitle>
              <Box className="text-muted-foreground size-4 group-hover:text-primary transition-colors" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pt-1">
            <div className="text-4xl font-bold tracking-tighter">
              {podsLoading ? <Skeleton className="h-10 w-16" /> : podsSummary?.totalCount}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-y-2 gap-x-4 text-[9px] font-bold uppercase tabular-nums">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Activity className="size-3" /> RUN {podsLoading ? '..' : podsSummary?.runningCount}
              </span>
              <span className="flex items-center gap-1.5 text-amber-500">
                <div className="size-1.5 rounded-full bg-amber-500 animate-pulse" /> PND {podsLoading ? '..' : podsSummary?.pendingCount}
              </span>
              <span className="flex items-center gap-1.5 text-blue-500">
                <CheckCircle className="size-3" /> CPD {podsLoading ? '..' : podsSummary?.completedCount}
              </span>
              <span className="flex items-center gap-1.5 text-red-500">
                <XCircle className="size-3" /> ERR {podsLoading ? '..' : (podsSummary ? podsSummary.failedCount + podsSummary.crashLoopCount : 0)}
              </span>
              {podsSummary && (podsSummary.otherCount ?? 0) > 0 && (
                <span className="flex items-center gap-1.5 text-slate-500 col-span-2 border-t border-dashed pt-1.5 mt-0.5">
                  <AlertTriangle className="size-3" /> OTH {podsSummary.otherCount} (Terminating/Unknown)
                </span>
              )}
            </div>
            {!podsLoading && (podsSummary?.crashLoopCount ?? 0) > 0 && (
              <div className="mt-2 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-[8px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5 uppercase ">
                <AlertTriangle className="size-2.5" /> {podsSummary?.crashLoopCount} CrashLoopBackOff Detected
              </div>
            )}
          </CardContent>
        </Card>

        {/* GPU 평균 사용률 */}
        <Card className="gap-3 py-4 shadow-sm border-none ring-1 ring-border border-t-4 border-t-violet-500 bg-violet-500/[0.02] group hover:bg-violet-500/[0.04] transition-all">
          <CardHeader className="px-5 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-violet-600 dark:text-violet-400 text-[10px] font-bold uppercase tracking-widest">Avg GPU Utilization</CardTitle>
              <Cpu className="text-violet-500 size-4" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pt-1">
            <div className="text-4xl font-bold tracking-tighter text-violet-600 dark:text-violet-400">
              {avgGpuUtilization}%
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2 text-[10px] font-bold text-violet-700/80 dark:text-violet-400/80 uppercase tracking-tight">
                <Zap className="size-3" />
                {busyGpuCount} / {allGpuDevices.length} GPUs Active
              </div>
              <Progress value={avgGpuUtilization} className={`h-1 bg-violet-200/50 dark:bg-violet-900/20 shadow-inner ${getGpuProgressClass(avgGpuUtilization)}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pod" className="space-y-4">
        <TabsList className="h-12 gap-1 p-1 bg-muted/40 border shadow-inner rounded-xl ring-1 ring-border">
          <TabsTrigger value="pod" className="gap-1.5 py-2 px-6 font-bold text-[11px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg"><Box className="size-3.5" />Pod</TabsTrigger>
          <TabsTrigger value="node" className="gap-1.5 py-2 px-6 font-bold text-[11px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg"><Server className="size-3.5" />Node</TabsTrigger>
          <TabsTrigger value="gpu" className="gap-1.5 py-2 px-6 font-bold text-[11px] uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg"><Cpu className="size-3.5" />GPU</TabsTrigger>
        </TabsList>

        {/* Pod 탭 */}
        <TabsContent value="pod" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between bg-card p-4 rounded-xl border ring-1 ring-border shadow-sm">
             <div className="flex flex-1 items-center gap-3 w-full sm:max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search Pod or Namespace..." 
                    className="pl-9 h-10 bg-muted/20 border-none ring-1 ring-border focus-visible:ring-primary/50"
                    value={podSearch}
                    onChange={(e) => setPodSearch(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px] h-10 bg-muted/20 border-none ring-1 ring-border">
                    <div className="flex items-center gap-2">
                      <Filter className="size-3.5 text-muted-foreground" />
                      <SelectValue placeholder="Status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Running">Running</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Succeeded">Completed</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                    <SelectItem value="CrashLoopBackOff">CrashLoop</SelectItem>
                    <SelectItem value="Terminating">Terminating</SelectItem>
                  </SelectContent>
                </Select>
             </div>
             <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full">
               Showing {filteredAndSortedPods.length} / {podsSummary?.totalCount || 0} Pods
             </div>
          </div>

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden ring-1 ring-border border-none">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-none border-b ring-1 ring-border">
                  <TableHead className="pl-6 font-bold uppercase text-[10px] tracking-widest text-muted-foreground/70">
                    <button onClick={() => toggleSort('namespace')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Namespace <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground/70">
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Pod Identifier <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground/70">
                    <button onClick={() => toggleSort('status' as any)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Health <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-center text-muted-foreground/70">
                    <button onClick={() => toggleSort('restarts')} className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors">
                      RST <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-center text-muted-foreground/70">GPU</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground/70">
                    <button onClick={() => toggleSort('age' as any)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Uptime <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {podsLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={7} className="pl-6 py-4"><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                  ))
                ) : paginatedPods.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-20 text-muted-foreground text-sm font-bold uppercase tracking-widest">No Pods Match Filters</TableCell></TableRow>
                ) : paginatedPods.map(pod => (
                  <TableRow key={pod.name} className="hover:bg-primary/[0.02] border-b last:border-0 group transition-colors">
                    <TableCell className="pl-6 font-mono text-[10px] text-muted-foreground font-bold tracking-tight">{pod.namespace.toUpperCase()}</TableCell>
                    <TableCell className="max-w-[280px] truncate font-mono text-xs text-foreground tracking-tight">{pod.name}</TableCell>
                    <TableCell>{getPodStatusBadge(pod.status)}</TableCell>
                    <TableCell className="text-center font-bold font-mono text-xs text-muted-foreground/80 tabular-nums">{pod.restarts}</TableCell>
                    <TableCell className="text-center">
                      {pod.hasGpu && <Badge className="bg-violet-500 text-white border-none text-[8px] h-3.5 px-1 font-bold tracking-tighter shadow-[0_0_5px_rgba(139,92,246,0.3)]">GPU</Badge>}
                    </TableCell>
                    <TableCell className="text-[10px] font-bold text-muted-foreground/60 tabular-nums">{pod.age.toUpperCase()}</TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:bg-primary/10 hover:text-primary transition-all rounded-md" onClick={() => setSelectedYaml({ title: pod.name, yaml: pod.yaml })}><Layers className="size-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* 페이지네이션 컨트롤 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-4 border-t border-dashed">
              <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 w-8 p-0" 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + i + 1 // dummy offset fix for map loop if needed, but standard p=i+1 is fine
                  const pageNum = i + 1
                  if (totalPages > 7 && (pageNum < currentPage - 2 || pageNum > currentPage + 2) && pageNum !== 1 && pageNum !== totalPages) {
                    if (pageNum === currentPage - 3 || pageNum === currentPage + 3) return <span key={pageNum} className="text-muted-foreground px-1">...</span>
                    return null
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 w-8 p-0 text-[10px] font-bold"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 w-8 p-0" 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Node 탭 */}
        <TabsContent value="node">
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden ring-1 ring-border border-none">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50 border-none border-b ring-1 ring-border">
                  <TableHead className="pl-6 font-bold uppercase text-[10px] tracking-widest text-muted-foreground/70">Host Identifier</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground/70">Status</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground/70">Role</TableHead>
                  <TableHead className="w-72 font-bold uppercase text-[10px] tracking-widest text-muted-foreground/70">Utilization</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-center text-muted-foreground/70">Pods</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground/70">Hardware Alerts</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nodeData.map(node => (
                  <TableRow key={node.name} className="hover:bg-primary/[0.02] border-b last:border-0 group transition-colors">
                    <TableCell className="pl-6 font-mono text-xs font-bold tracking-tighter text-foreground">{node.name.toUpperCase()}</TableCell>
                    <TableCell>{getNodeStatusBadge(node.status)}</TableCell>
                    <TableCell>{getNodeRoleBadge(node.role)}</TableCell>
                    <TableCell>
                      <div className="space-y-2 py-3 px-1">
                        <div className="flex justify-between text-[9px] uppercase font-bold text-muted-foreground/90 tabular-nums tracking-widest">
                          <span className="flex items-center gap-1.5"><div className="size-1 rounded-full bg-emerald-500" /> CPU {node.cpuUsage}%</span>
                          <span className="flex items-center gap-1.5"><div className="size-1 rounded-full bg-blue-500" /> MEM {node.memoryUsage}%</span>
                        </div>
                        <div className="flex gap-2">
                           <Progress value={node.cpuUsage} className={`h-1.5 flex-1 shadow-inner rounded-full ${getCpuProgressClass(node.cpuUsage)}`} />
                           <Progress value={node.memoryUsage} className={`h-1.5 flex-1 shadow-inner rounded-full ${getMemProgressClass(node.memoryUsage)}`} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-bold font-mono text-xs tabular-nums text-foreground/80">{node.podCount}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        {node.diskPressure ? <Badge variant="destructive" className="h-4 text-[8px] px-1 font-bold  tracking-tighter">DISK_ALERT</Badge> : <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1"><div className="size-1 rounded-full bg-emerald-500 shadow-[0_0_3px_#10b881]" />Optimal</span>}
                      </div>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 hover:bg-primary/10 hover:text-primary transition-all rounded-md" onClick={() => setSelectedYaml({ title: node.name, yaml: node.yaml })}><Layers className="size-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* GPU 탭 */}
        <TabsContent value="gpu">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {gpuData.map(gpuNode => (
              <Card key={gpuNode.nodeName} className="border-l-4 border-l-violet-500 shadow-lg overflow-hidden ring-1 ring-border border-none bg-card/50 backdrop-blur-sm group hover:ring-violet-500/40 transition-all">
                <CardHeader className="pb-3 bg-muted/30 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="font-mono text-sm flex items-center gap-2 font-bold tracking-tight">
                        <div className="p-1 bg-violet-500/10 rounded-md">
                           <Cpu className="size-4 text-violet-500 animate-pulse" />
                        </div>
                        {gpuNode.nodeName.toUpperCase()}
                      </CardTitle>
                      <CardDescription className="text-[10px] font-bold mt-2 text-muted-foreground/80 tracking-widest flex items-center gap-2">
                        {gpuNode.gpuModel} &middot; <span className="text-violet-500">{gpuNode.devices.length} ACCELERATORS</span>
                      </CardDescription>
                    </div>
                    <Badge className="bg-violet-600 text-white border-none text-[8px] h-5 font-bold tracking-widest shadow-[0_0_10px_rgba(139,92,246,0.2)]">LIVE</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-5 grid grid-cols-2 gap-4">
                  {gpuNode.devices.map(dev => (
                    <div key={dev.index} className="bg-background/80 rounded-xl p-4 border shadow-sm hover:border-violet-500/40 hover:shadow-md transition-all group/item">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-bold text-muted-foreground/60 font-mono">XID_{dev.index}</span>
                        </div>
                        {getGpuStatusBadge(dev.status)}
                      </div>
                      <Progress value={dev.utilization} className={`h-2.5 mb-4 shadow-inner rounded-full ${getGpuProgressClass(dev.utilization)}`} />
                      <div className="flex justify-between items-end text-[10px] font-bold font-mono">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] text-muted-foreground/40 uppercase tracking-widest font-bold">Compute Load</span>
                          <span className="text-violet-500 text-lg leading-none ">{dev.utilization}%</span>
                        </div>
                        <div className="text-right flex flex-col gap-0.5">
                          <span className="text-[8px] text-muted-foreground/40 uppercase tracking-widest font-bold">Metrics</span>
                          <span className="text-[10px] leading-none text-foreground/80 tabular-nums">{dev.temperature}°C / {dev.power}W</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* YAML 뷰어 모달 */}
      {selectedYaml && (
        <YamlViewerModal open={!!selectedYaml} onClose={() => setSelectedYaml(null)} title={selectedYaml.title} yaml={selectedYaml.yaml} />
      )}
    </div>
  )
}
