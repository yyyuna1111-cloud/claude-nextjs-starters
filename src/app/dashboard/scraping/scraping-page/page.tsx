'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
  Code,
  List,
  Loader2,
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

interface RunFile {
  key: string
  size: number
  lastModified: string | null
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
  // Pod 타입(실제 실행 단계)만 필터
  const pods = Object.values(nodes).filter(
    n => n.type === 'Pod' || n.type === 'Steps' || n.type === 'DAG'
  )
  if (pods.length === 0) return Object.values(nodes).slice(0, 8).map(n => ({
    id: n.id,
    label: n.displayName ?? n.id,
    status: argoPhaseToStatus(n.phase),
    duration: n.startedAt && n.finishedAt
      ? `${Math.round((new Date(n.finishedAt).getTime() - new Date(n.startedAt).getTime()) / 1000)}s`
      : null,
  }))

  return pods
    .sort(
      (a, b) =>
        new Date(a.startedAt ?? 0).getTime() -
        new Date(b.startedAt ?? 0).getTime()
    )
    .map(n => ({
      id: n.id,
      label: n.displayName ?? n.id,
      status: argoPhaseToStatus(n.phase),
      duration:
        n.startedAt && n.finishedAt
          ? `${Math.round((new Date(n.finishedAt).getTime() - new Date(n.startedAt).getTime()) / 1000)}s`
          : null,
    }))
}

// ─── 서브 컴포넌트 ────────────────────────────────────────────────────────────

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
  const [runs, setRuns] = useState<RunFile[]>([])
  const [dataRows, setDataRows] = useState<DataRow[]>([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)

  // 워크플로우 행 확장 (DAG)
  const [expandedWf, setExpandedWf] = useState<string | null>(null)
  const [wfDetail, setWfDetail] = useState<ArgoWorkflow | null>(null)
  const [wfDetailLoading, setWfDetailLoading] = useState(false)

  // 데이터 JSON 패널
  const [jsonRow, setJsonRow] = useState<DataRow | null>(null)

  // 트리거 라이브 패널
  const [liveOpen, setLiveOpen] = useState(false)
  const [liveWfName, setLiveWfName] = useState<string | null>(null)
  const [liveWf, setLiveWf] = useState<ArgoWorkflow | null>(null)
  const [events, setEvents] = useState<EventLog[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const eventsEndRef = useRef<HTMLDivElement>(null)

  // ── fetch 전체 ─────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [wfRes, runsRes, dataRes] = await Promise.all([
        fetch('/api/scraping/workflows'),
        fetch('/api/scraping/runs'),
        fetch('/api/scraping/data?limit=50'),
      ])
      const [wfData, runsData, rowsData] = await Promise.all([
        wfRes.json(),
        runsRes.json(),
        dataRes.json(),
      ])
      setWorkflows(wfData.workflows ?? [])
      setRuns(
        (runsData.files ?? []).sort(
          (a: RunFile, b: RunFile) =>
            new Date(b.lastModified ?? 0).getTime() -
            new Date(a.lastModified ?? 0).getTime()
        )
      )
      setDataRows(rowsData.rows ?? [])
    } catch {
      toast.error('데이터 로딩 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

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
  async function handleTrigger() {
    const confirmed = window.confirm('세금 데이터 수집 워크플로우를 시작하겠습니까?')
    if (!confirmed) return

    setTriggering(true)
    setLiveOpen(true)
    setLiveWfName(null)
    setLiveWf(null)
    setEvents([{ time: new Date().toLocaleTimeString(), message: '워크플로우 제출 중...', type: 'info' }])

    try {
      const res = await fetch('/api/scraping/trigger', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        addEvent(`제출 실패: ${data.error ?? res.statusText}`, 'error')
        toast.error(`수집 시작 실패: ${data.error ?? res.statusText}`)
        setTriggering(false)
        return
      }

      const wfName: string =
        data.metadata?.name ?? data.name ?? '(이름 없음)'
      setLiveWfName(wfName)
      addEvent(`워크플로우 제출 완료: ${wfName}`, 'success')
      addEvent('상태 폴링 시작...', 'info')
      startPolling(wfName)
    } catch (e) {
      addEvent(`오류: ${String(e)}`, 'error')
      toast.error('수집 트리거 중 오류가 발생했습니다.')
    } finally {
      setTriggering(false)
    }
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

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
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

  const dataColumns = dataRows.length > 0 ? Object.keys(dataRows[0]) : []

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
                    <>
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
                    </>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 실행 이력 */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">실행 이력</CardTitle>
          <CardDescription className="text-xs">
            S3 runs/ 폴더 파일 목록 (최신순)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              {loading ? '로딩 중...' : '실행 이력이 없습니다.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>파일명</TableHead>
                  <TableHead className="text-right">크기</TableHead>
                  <TableHead>수정일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map(file => (
                  <TableRow key={file.key}>
                    <TableCell className="font-mono text-xs">{file.key}</TableCell>
                    <TableCell className="text-muted-foreground text-right text-xs">
                      {formatBytes(file.size)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDate(file.lastModified)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 수집 데이터 - 테이블/JSON 탭 + 행 클릭 JSON 패널 */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">수집 데이터</CardTitle>
          <CardDescription className="text-xs">
            output/tax_data.jsonl 최근 50건 · 행을 클릭하면 JSON 전체를 볼 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {dataRows.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              {loading ? '로딩 중...' : '데이터 없음'}
            </p>
          ) : (
            <Tabs defaultValue="table">
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
                      {dataRows.map((row, idx) => (
                        <TableRow
                          key={idx}
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
              </TabsContent>

              {/* JSON 전체 뷰 */}
              <TabsContent value="json" className="mt-0 p-4">
                <pre className="bg-muted max-h-[500px] overflow-auto rounded-lg p-4 text-xs">
                  {JSON.stringify(dataRows, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

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

          {/* 이벤트 로그 */}
          <div className="mt-4 flex-1 space-y-1 overflow-auto">
            <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
              이벤트 로그
            </p>
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

          {/* 라이브 DAG */}
          {liveSteps.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                파이프라인 DAG
              </p>
              <PipelineDag steps={liveSteps} />
            </div>
          )}

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
        </SheetContent>
      </Sheet>
    </div>
  )
}