'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Database,
  Play,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Code,
  List,
  Loader2,
  Download,
  Square,
  Trash2,
  ScrollText,
  Info,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PipelineDag } from '@/components/train/pipeline-dag'

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface ArgoNode {
  id: string
  displayName?: string
  type?: string
  phase?: string
  startedAt?: string
  finishedAt?: string
  children?: string[]
  outboundNodes?: string[]
}

interface ArgoWorkflow {
  metadata?: { name?: string; creationTimestamp?: string }
  status?: {
    phase?: string
    startedAt?: string
    finishedAt?: string
    nodes?: Record<string, ArgoNode>
    message?: string
  }
}

interface RunResult {
  key: string
  lastModified: string | null
  run_id?: string
  finished_at?: string
  status?: string
  total_new?: number
  curated_new?: number
  target_menus?: Record<string, string>
  collected?: Record<string, number>
}

type DataRow = Record<string, unknown>

// 트리거 후 라이브 패널에서 쓸 이벤트 로그
interface EventLog {
  time: string
  message: string
  type: 'info' | 'success' | 'error'
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function argoPhaseToStatus(
  phase?: string
): 'completed' | 'running' | 'pending' | 'failed' {
  if (phase === 'Succeeded') return 'completed'
  if (phase === 'Running') return 'running'
  if (phase === 'Failed' || phase === 'Error') return 'failed'
  return 'pending'
}

/** Argo status.nodes → PipelineDag steps 변환 */
function nodesToSteps(nodes: Record<string, ArgoNode>) {
  const toStep = (n: ArgoNode) => ({
    id: n.id,
    label: n.displayName ?? n.id,
    status: argoPhaseToStatus(n.phase),
    duration:
      n.startedAt && n.finishedAt
        ? `${Math.round((new Date(n.finishedAt).getTime() - new Date(n.startedAt).getTime()) / 1000)}s`
        : null,
  })

  const sortByStart = (a: ArgoNode, b: ArgoNode) => {
    const ta = a.startedAt ? new Date(a.startedAt).getTime() : Infinity
    const tb = b.startedAt ? new Date(b.startedAt).getTime() : Infinity
    return ta - tb
  }

  // Pod 타입(실제 실행 단계)만 사용
  const pods = Object.values(nodes).filter(n => n.type === 'Pod')
  if (pods.length > 0) return pods.sort(sortByStart).map(toStep)

  // Pod 없으면 DAG/Steps 제외한 나머지
  const others = Object.values(nodes).filter(n => n.type !== 'DAG' && n.type !== 'Steps')
  if (others.length > 0) return others.sort(sortByStart).map(toStep)

  return []
}

// ─── 서브 컴포넌트 ────────────────────────────────────────────────────────────

function ParamRow({
  paramKey,
  label,
  desc,
  tooltip,
  type,
  params,
  setParams,
}: {
  paramKey: string
  label: string
  desc: string
  tooltip?: string
  type?: string
  params: Record<string, string>
  setParams: React.Dispatch<React.SetStateAction<Record<string, string>>>
}) {
  return (
    <div className="grid grid-cols-5 items-center gap-2">
      <Label className="col-span-2 flex items-center gap-1 text-xs">
        {label}
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="text-muted-foreground size-3 cursor-help shrink-0" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] border border-border bg-popover text-popover-foreground shadow-sm">
              <div className="space-y-1">
                {tooltip.split('\n').map((line, i) => (
                  <p key={i} className="text-xs leading-relaxed">{line}</p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </Label>
      <div className="col-span-3">
        <Input
          className="h-7 text-xs"
          type={type}
          value={params[paramKey] ?? ''}
          onChange={e => setParams(p => ({ ...p, [paramKey]: e.target.value }))}
          placeholder={desc}
        />
      </div>
    </div>
  )
}

function WorkflowBadge({ phase }: { phase?: string }) {
  const map: Record<string, string> = {
    Running: 'bg-blue-500 text-white border-transparent',
    Succeeded: 'bg-green-500 text-white border-transparent',
    Failed: 'bg-destructive text-destructive-foreground border-transparent',
    Error: 'bg-destructive text-destructive-foreground border-transparent',
    Pending: 'border-yellow-400 text-yellow-600 dark:text-yellow-400',
  }
  const label = phase ?? 'Unknown'
  return (
    <Badge
      variant="outline"
      className={map[label] ?? 'text-muted-foreground'}
    >
      {label}
    </Badge>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function ScrapingPage() {
  const [workflows, setWorkflows] = useState<ArgoWorkflow[]>([])
  const [runs, setRuns] = useState<RunResult[]>([])
  const [dataRows, setDataRows] = useState<DataRow[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)

  // 워크플로우 행 확장 (DAG)
  const [expandedWf, setExpandedWf] = useState<string | null>(null)
  const [wfDetail, setWfDetail] = useState<ArgoWorkflow | null>(null)
  const [wfDetailLoading, setWfDetailLoading] = useState(false)

  // 파라미터 다이얼로그
  const [paramOpen, setParamOpen] = useState(false)
  const [credOpen, setCredOpen] = useState(false)
const [params, setParams] = useState<Record<string, string>>({
    AUTO_DETECT: 'false',
    CAFE_URL_INPUT: 'https://cafe.naver.com/aclove',
    KEYWORD: '기장',
    USE_SEARCH: 'true',
    LIMIT_PER_KEYWORD: '2',
    BACKFILL_DAYS: '0',
    NAVER_ID: '',
    NAVER_PW: '',
  })

  // 데이터 JSON 패널
  const [jsonRow, setJsonRow] = useState<DataRow | null>(null)

  // 실행 이력 페이징
  const RUNS_PAGE_SIZE = 6
  const [runsPage, setRunsPage] = useState(1)

  // 데이터 테이블 필터/정렬/페이징
  const PAGE_SIZE = 10
  const [dataPage, setDataPage] = useState(1)
  const [dataTotal, setDataTotal] = useState(0)
  const [dataSortDesc, setDataSortDesc] = useState(true)
  const [dataDateFrom, setDataDateFrom] = useState('')
  const [dataDateTo, setDataDateTo] = useState('')

  // 트리거 라이브 패널
  const [liveOpen, setLiveOpen] = useState(false)
  const [liveWfName, setLiveWfName] = useState<string | null>(null)
  const [liveWf, setLiveWf] = useState<ArgoWorkflow | null>(null)
  const [events, setEvents] = useState<EventLog[]>([])
  const [logLines, setLogLines] = useState<string[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const eventsEndRef = useRef<HTMLDivElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // ── fetch 전체 ─────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [wfRes, runsRes, dataRes] = await Promise.all([
        fetch('/api/scraping/workflows'),
        fetch('/api/scraping/runs'),
        fetch('/api/scraping/data?limit=0'),
      ])
      const [wfData, runsData, rowsData] = await Promise.all([
        wfRes.json(),
        runsRes.json(),
        dataRes.json(),
      ])
      setWorkflows(wfData.workflows ?? [])
      setRuns(runsData.runs ?? [])
      setDataRows(rowsData.rows ?? [])
      setDataTotal(rowsData.total ?? 0)
    } catch {
      toast.error('데이터 로딩 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // 자동 갱신: Running 워크플로우 있으면 5초, 없으면 30초
  useEffect(() => {
    const hasRunning = workflows.some(wf => wf.status?.phase === 'Running')
    const interval = hasRunning ? 5000 : 30000
    const id = setInterval(fetchAll, interval)
    return () => clearInterval(id)
  }, [fetchAll, workflows])

  // 펼쳐진 DAG 자동 갱신 (5초)
  useEffect(() => {
    if (!expandedWf) return
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/scraping/workflows/${expandedWf}`)
        const data = await res.json()
        setWfDetail(data)
      } catch {}
    }, 5000)
    return () => clearInterval(id)
  }, [expandedWf])

  // ── 워크플로우 행 클릭 → DAG 펼침 ─────────────────────────────────────────
  async function handleWfClick(name: string) {
    if (expandedWf === name) {
      setExpandedWf(null)
      setWfDetail(null)
      return
    }
    setExpandedWf(name)
    setWfDetailLoading(true)
    try {
      const res = await fetch(`/api/scraping/workflows/${name}`)
      const data = await res.json()
      setWfDetail(data)
    } catch {
      toast.error('워크플로우 상세 조회 실패')
    } finally {
      setWfDetailLoading(false)
    }
  }

  // ── 수집 트리거 ────────────────────────────────────────────────────────────
  function handleTrigger() {
    setParamOpen(true)
  }

  async function submitTrigger() {
    setParamOpen(false)
    setTriggering(true)
    setLiveOpen(true)
    setLiveWfName(null)
    setLiveWf(null)
    setLogLines([])
    setEvents([{ time: new Date().toLocaleTimeString(), message: '워크플로우 제출 중...', type: 'info' }])

    try {
      const res = await fetch('/api/scraping/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: params }),
      })
      const data = await res.json()

      if (!res.ok) {
        addEvent(`제출 실패: ${data.error ?? res.statusText}`, 'error')
        toast.error(`수집 시작 실패: ${data.error ?? res.statusText}`)
        setTriggering(false)
        return
      }

      const wfName: string =
        data.workflow?.metadata?.name ?? data.metadata?.name ?? '(이름 없음)'
      addEvent(`워크플로우 제출 완료: ${wfName}`, 'success')
      setLiveWfName(wfName)
      fetchAll()
      startPolling(wfName)
      startLogStream(wfName)
    } catch (e) {
      addEvent(`오류: ${String(e)}`, 'error')
      toast.error('수집 트리거 중 오류가 발생했습니다.')
    } finally {
      setTriggering(false)
    }
  }

  function openLivePanel(wfName: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    if (logPollRef.current) clearInterval(logPollRef.current)
    setLiveOpen(true)
    setLiveWfName(wfName)
    setLiveWf(null)
    setLogLines([])
    setEvents([{ time: new Date().toLocaleTimeString(), message: `워크플로우 조회: ${wfName}`, type: 'info' }])
    startPolling(wfName)
    startLogStream(wfName)
  }

  function addEvent(message: string, type: EventLog['type'] = 'info') {
    setEvents(prev => [
      ...prev,
      { time: new Date().toLocaleTimeString(), message, type },
    ])
    setTimeout(() => eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  function startPolling(wfName: string) {
    if (pollRef.current) clearInterval(pollRef.current)

    let prevPhase = ''
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/scraping/workflows/${wfName}`)
        const wf: ArgoWorkflow = await res.json()
        setLiveWf(wf)

        const phase = wf.status?.phase ?? 'Unknown'
        if (phase !== prevPhase) {
          addEvent(`상태 변경: ${prevPhase || '—'} → ${phase}`, phase === 'Succeeded' ? 'success' : phase === 'Failed' || phase === 'Error' ? 'error' : 'info')
          prevPhase = phase
        }

        if (phase === 'Succeeded' || phase === 'Failed' || phase === 'Error') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          addEvent('워크플로우 종료', phase === 'Succeeded' ? 'success' : 'error')
          fetchAll()
        }
      } catch {
        addEvent('폴링 오류', 'error')
      }
    }, 3000)
  }

  function startLogStream(wfName: string) {
    if (logPollRef.current) clearInterval(logPollRef.current)

    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/scraping/workflows/${wfName}/logs`)
        const data = await res.json()
        if (data.error) {
          addEvent(`로그 오류: ${data.error}`, 'error')
          return
        }
        addEvent(`로그 응답: ${data.lines?.length ?? 0}줄`, 'info')
        if (data.lines?.length > 0) {
          setLogLines(data.lines)
          setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      } catch (e) {
        addEvent(`로그 fetch 실패: ${String(e)}`, 'error')
      }
    }

    fetchLogs()
    logPollRef.current = setInterval(fetchLogs, 5000)
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (logPollRef.current) clearInterval(logPollRef.current)
    }
  }, [])

  // ── 집계 ──────────────────────────────────────────────────────────────────
  const wfCounts = workflows.reduce(
    (acc, wf) => {
      const p = wf.status?.phase ?? 'Unknown'
      acc[p] = (acc[p] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // input/output 관련 컬럼 우선 배치 (실제 필드명 확인 후 수정)
  const PRIORITY_COLS = ['input', 'output', 'query', 'answer', 'question', 'content', 'title', 'url']
  const dataColumns = dataRows.length > 0
    ? [
        ...PRIORITY_COLS.filter(c => Object.keys(dataRows[0]).includes(c)),
        ...Object.keys(dataRows[0]).filter(c => !PRIORITY_COLS.includes(c)),
      ]
    : []
  const filteredRows = dataRows
    .filter(row => {
      const val = row.curated_at as string | undefined
      if (!val) return true
      const d = val.slice(0, 10)
      if (dataDateFrom && d < dataDateFrom) return false
      if (dataDateTo && d > dataDateTo) return false
      return true
    })
    .sort((a, b) => {
      const av = (a.curated_at as string) ?? ''
      const bv = (b.curated_at as string) ?? ''
      return dataSortDesc ? bv.localeCompare(av) : av.localeCompare(bv)
    })
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE)
  const pagedRows = filteredRows.slice((dataPage - 1) * PAGE_SIZE, dataPage * PAGE_SIZE)

  // ── DAG steps (확장된 워크플로우) ─────────────────────────────────────────
  const dagSteps =
    wfDetail?.status?.nodes ? nodesToSteps(wfDetail.status.nodes) : []

  // ── DAG steps (라이브 패널) ───────────────────────────────────────────────
  const liveSteps =
    liveWf?.status?.nodes ? nodesToSteps(liveWf.status.nodes) : []

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Database className="size-6" />
            Data Scraping
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            세금 데이터 수집 워크플로우
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleTrigger} disabled={triggering}>
            {triggering ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Play className="mr-2 size-4" />
            )}
            {triggering ? '제출 중...' : '수집 시작'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 상태 카운트 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <RefreshCw className="size-8 text-blue-500" />
            <div>
              <p className="text-muted-foreground text-xs">Running</p>
              <p className="text-2xl font-bold">{wfCounts['Running'] ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <CheckCircle className="size-8 text-green-500" />
            <div>
              <p className="text-muted-foreground text-xs">Succeeded</p>
              <p className="text-2xl font-bold">{wfCounts['Succeeded'] ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <XCircle className="size-8 text-destructive" />
            <div>
              <p className="text-muted-foreground text-xs">Failed</p>
              <p className="text-2xl font-bold">
                {(wfCounts['Failed'] ?? 0) + (wfCounts['Error'] ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 실행 이력 */}
      {runs.length > 0 && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-base">실행 이력</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-right">게시글</TableHead>
                  <TableHead className="text-right">데이터</TableHead>
                  <TableHead>완료 시각</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.slice((runsPage - 1) * RUNS_PAGE_SIZE, runsPage * RUNS_PAGE_SIZE).map(run => (
                  <TableRow key={run.key}>
                    <TableCell className="font-mono text-xs">{run.run_id ?? run.key}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={run.status === 'done' ? 'border-green-500 text-green-500 text-xs' : 'text-xs'}>
                        {run.status ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">{run.total_new?.toLocaleString() ?? '—'}</TableCell>
                    <TableCell className="text-right text-xs">{run.curated_new?.toLocaleString() ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(run.finished_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {runs.length > RUNS_PAGE_SIZE && (
              <div className="flex items-center justify-between border-t px-4 py-2">
                <span className="text-muted-foreground text-xs">
                  {(runsPage - 1) * RUNS_PAGE_SIZE + 1}–{Math.min(runsPage * RUNS_PAGE_SIZE, runs.length)} / {runs.length}건
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={runsPage === 1} onClick={() => setRunsPage(p => p - 1)}>
                    <ChevronLeft className="size-3" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={runsPage >= Math.ceil(runs.length / RUNS_PAGE_SIZE)} onClick={() => setRunsPage(p => p + 1)}>
                    <ChevronRight className="size-3" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 워크플로우 목록 - 행 클릭 시 DAG 펼침 */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">Argo Workflow 목록</CardTitle>
          <CardDescription className="text-xs">
            행을 클릭하면 파이프라인 DAG를 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {workflows.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              {loading ? '로딩 중...' : 'Argo 워크플로우가 없습니다.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6" />
                  <TableHead>워크플로우 이름</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>시작</TableHead>
                  <TableHead>완료</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((wf, idx) => {
                  const name = wf.metadata?.name ?? String(idx)
                  const isExpanded = expandedWf === name
                  const steps =
                    isExpanded && wfDetail?.status?.nodes
                      ? dagSteps
                      : []

                  return (
                    <React.Fragment key={name}>
                      <TableRow
                        key={name}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => handleWfClick(name)}
                      >
                        <TableCell className="text-muted-foreground">
                          {isExpanded ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{name}</TableCell>
                        <TableCell>
                          <WorkflowBadge phase={wf.status?.phase} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatDate(wf.status?.startedAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDate(wf.status?.finishedAt)}
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {wf.status?.phase === 'Running' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-yellow-500 hover:text-yellow-600"
                                title="Stop"
                                onClick={async () => {
                                  if (!window.confirm(`${name} 을 중단하겠습니까?`)) return
                                  await fetch(`/api/scraping/workflows/${name}/stop`, { method: 'PUT' })
                                  toast.success('워크플로우 중단 요청 완료')
                                  fetchAll()
                                }}
                              >
                                <Square className="size-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive size-7"
                              title="Delete"
                              onClick={async () => {
                                if (!window.confirm(`${name} 을 삭제하겠습니까?`)) return
                                await fetch(`/api/scraping/workflows/${name}/delete`, { method: 'DELETE' })
                                toast.success('워크플로우 삭제 완료')
                                fetchAll()
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow key={`${name}-dag`}>
                          <TableCell colSpan={5} className="bg-muted/30 p-4">
                            {wfDetailLoading ? (
                              <div className="flex items-center gap-2 text-sm">
                                <Loader2 className="size-4 animate-spin" />
                                DAG 로딩 중...
                              </div>
                            ) : steps.length > 0 ? (
                              <PipelineDag steps={steps} />
                            ) : (
                              <p className="text-muted-foreground text-sm">
                                노드 정보가 없습니다.
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>


      {/* 수집 데이터 - 테이블/JSON 탭 + 페이징 + 다운로드 */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">수집 데이터</CardTitle>
                {dataTotal > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    총 {dataTotal.toLocaleString()}건
                  </span>
                )}
              </div>
              <CardDescription className="text-xs">
                output/tax_data.jsonl · 행 클릭 시 JSON 상세
              </CardDescription>
            </div>
            {dataRows.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    const a = document.createElement('a')
                    a.href = '/api/scraping/download?format=csv'
                    a.download = 'tax_data.csv'
                    a.click()
                  }}
                >
                  <Download className="mr-1 size-3" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    const a = document.createElement('a')
                    a.href = '/api/scraping/download?format=json'
                    a.download = 'tax_data.json'
                    a.click()
                  }}
                >
                  <Download className="mr-1 size-3" />
                  JSON
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {dataRows.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              {loading ? '로딩 중...' : '데이터 없음'}
            </p>
          ) : (
            <Tabs defaultValue="table" onValueChange={() => setDataPage(1)}>
              <div className="border-b px-4 pt-2">
                <TabsList className="h-8">
                  <TabsTrigger value="table" className="gap-1 text-xs">
                    <List className="size-3" />
                    테이블
                  </TabsTrigger>
                  <TabsTrigger value="json" className="gap-1 text-xs">
                    <Code className="size-3" />
                    JSON
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* 필터 바 */}
              <div className="flex items-center gap-2 border-b px-4 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setDataSortDesc(v => !v); setDataPage(1) }}
                >
                  {dataSortDesc ? '최신순' : '오래된순'}
                </Button>
                <input
                  type="date"
                  className="h-7 rounded-md border px-2 text-xs"
                  value={dataDateFrom}
                  onChange={e => { setDataDateFrom(e.target.value); setDataPage(1) }}
                />
                <span className="text-xs text-muted-foreground">~</span>
                <input
                  type="date"
                  className="h-7 rounded-md border px-2 text-xs"
                  value={dataDateTo}
                  onChange={e => { setDataDateTo(e.target.value); setDataPage(1) }}
                />
                {(dataDateFrom || dataDateTo) && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setDataDateFrom(''); setDataDateTo(''); setDataPage(1) }}>
                    초기화
                  </Button>
                )}
                <span className="ml-auto text-xs text-muted-foreground">{filteredRows.length.toLocaleString()}건</span>
              </div>

              {/* 테이블 뷰 */}
              <TabsContent value="table" className="mt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {dataColumns.map(col => (
                          <TableHead key={col} className="whitespace-nowrap">
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedRows.map((row, idx) => (
                        <TableRow
                          key={(dataPage - 1) * PAGE_SIZE + idx}
                          className="cursor-pointer hover:bg-accent/50"
                          onClick={() => setJsonRow(row)}
                        >
                          {dataColumns.map(col => (
                            <TableCell
                              key={col}
                              className="max-w-[200px] truncate text-xs"
                              title={String(row[col] ?? '')}
                            >
                              {String(row[col] ?? '—')}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* 페이징 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t px-4 py-3">
                    <span className="text-muted-foreground text-xs">
                      {(dataPage - 1) * PAGE_SIZE + 1}–{Math.min(dataPage * PAGE_SIZE, filteredRows.length)} / {filteredRows.length}건
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        disabled={dataPage === 1}
                        onClick={() => setDataPage(p => p - 1)}
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - dataPage) <= 1)
                        .reduce<(number | '...')[]>((acc, p, i, arr) => {
                          if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...')
                          acc.push(p)
                          return acc
                        }, [])
                        .map((p, i) =>
                          p === '...' ? (
                            <span key={`ellipsis-${i}`} className="text-muted-foreground px-1 text-xs">…</span>
                          ) : (
                            <Button
                              key={p}
                              variant={dataPage === p ? 'default' : 'outline'}
                              size="icon"
                              className="size-7 text-xs"
                              onClick={() => setDataPage(p as number)}
                            >
                              {p}
                            </Button>
                          )
                        )}
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        disabled={dataPage === totalPages}
                        onClick={() => setDataPage(p => p + 1)}
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* JSON 전체 뷰 */}
              <TabsContent value="json" className="mt-0 p-4">
                <pre className="bg-muted max-h-[500px] overflow-auto rounded-lg p-4 text-xs">
                  {JSON.stringify(filteredRows, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* 파라미터 입력 다이얼로그 */}
      <Dialog open={paramOpen} onOpenChange={setParamOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">수집 파라미터 설정</DialogTitle>
          </DialogHeader>
          <TooltipProvider delayDuration={100}>
          <div className="space-y-2 py-2">
            <ParamRow paramKey="AUTO_DETECT" label="카페 자동 수집" desc="true / false" params={params} setParams={setParams}
              tooltip="true → 아래 URL·키워드로 게시판 자동 인식&#10;false → aclove 카페 541 게시판 고정" />
            <div className="ml-3 space-y-2 border-l-2 border-muted pl-3">
              <ParamRow paramKey="CAFE_URL_INPUT" label="카페 URL" desc="AUTO_DETECT=true일 때만" params={params} setParams={setParams} />
              <ParamRow paramKey="KEYWORD" label="게시판 필터 키워드" desc="AUTO_DETECT=true일 때만" params={params} setParams={setParams} />
            </div>
            <ParamRow paramKey="USE_SEARCH" label="키워드 검색 수집" desc="true / false" params={params} setParams={setParams}
              tooltip="true → 게시판 수집 + 키워드 검색 수집&#10;false → 게시판 수집만" />
            <div className="ml-3 border-l-2 border-muted pl-3">
              <ParamRow paramKey="LIMIT_PER_KEYWORD" label="키워드당 최대 건수" desc="USE_SEARCH=true일 때만" params={params} setParams={setParams} />
            </div>
            <ParamRow paramKey="BACKFILL_DAYS" label="첫 실행 수집 기간 (일)" desc="0=전체, 7=최근 7일" params={params} setParams={setParams}
              tooltip="처음 실행 시 과거 몇 일치를 수집할지 설정&#10;0이면 전체, 7이면 최근 7일치만" />

            {/* 로그인 정보 드롭다운 */}
            <div className="border-t pt-2">
              <button
                type="button"
                className="flex w-full items-center gap-1 text-sm text-foreground/70 hover:text-foreground transition-colors"
                onClick={() => setCredOpen(v => !v)}
              >
                {credOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                네이버 계정 입력 (선택)
              </button>
              {credOpen && (
                <div className="mt-2 space-y-2">
                  <ParamRow paramKey="NAVER_ID" label="아이디" desc="미입력 시 기본값" params={params} setParams={setParams} />
                  <ParamRow paramKey="NAVER_PW" label="비밀번호" desc="미입력 시 기본값" type="password" params={params} setParams={setParams} />
                </div>
              )}
            </div>
          </div>
          </TooltipProvider>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setParamOpen(false)}>취소</Button>
            <Button size="sm" onClick={submitTrigger}>
              <Play className="mr-1 size-3" />
              수집 시작
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JSON 행 상세 패널 (우측 Sheet) */}
      <Sheet open={jsonRow !== null} onOpenChange={open => !open && setJsonRow(null)}>
        <SheetContent className="w-[480px] sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Code className="size-4" />
              Row JSON
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 overflow-auto">
            <pre className="bg-muted rounded-lg p-4 text-xs leading-relaxed">
              {JSON.stringify(jsonRow, null, 2)}
            </pre>
          </div>
        </SheetContent>
      </Sheet>

      {/* 수집 트리거 라이브 패널 */}
      <Sheet open={liveOpen} onOpenChange={setLiveOpen}>
        <SheetContent className="flex w-[520px] flex-col sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Play className="size-4" />
              수집 워크플로우 실행 중
              {liveWfName && (
                <span className="text-muted-foreground font-mono text-xs">
                  · {liveWfName}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          {/* 워크플로우 상태 배지 */}
          {liveWf?.status?.phase && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-muted-foreground text-xs">현재 상태:</span>
              <WorkflowBadge phase={liveWf.status.phase} />
              {liveWf.status.message && (
                <span className="text-muted-foreground truncate text-xs">
                  {liveWf.status.message}
                </span>
              )}
            </div>
          )}


          {/* DAG 단계 */}
          {liveSteps.length > 0 && (
            <div className="mt-4">
              <p className="text-muted-foreground mb-2 text-xs">파이프라인 단계</p>
              <PipelineDag steps={liveSteps} />
            </div>
          )}

          {/* 이벤트 */}
          <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-auto">
            <div className="space-y-1">
              <div className="space-y-1">
                {events.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground shrink-0 font-mono">
                      {e.time}
                    </span>
                    <span
                      className={
                        e.type === 'success'
                          ? 'text-green-500'
                          : e.type === 'error'
                            ? 'text-destructive'
                            : 'text-foreground'
                      }
                    >
                      {e.message}
                    </span>
                  </div>
                ))}
                <div ref={eventsEndRef} />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}