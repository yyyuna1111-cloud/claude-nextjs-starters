// 학습 실행 페이지 - 서버 컴포넌트
// KFP API에서 run 목록 조회 (실패 시 더미 데이터 fallback)

import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrainSearchFilter } from '@/components/train/train-search-filter'
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

export const metadata: Metadata = {
  title: '학습 실행',
}

type TrainStatus = 'Queued' | 'Running' | 'Succeeded' | 'Failed' | 'Canceled'
type TrainMode = '단일 GPU' | '분산 학습' | 'CPU 전용'

interface TrainJob {
  runId: string
  projectName: string
  trainName: string
  requester: string
  status: TrainStatus
  trainMode: TrainMode
  gpuCount: number
  createdAt: string
}

const dummyJobs: TrainJob[] = [
  {
    runId: 'run-20240101-001',
    projectName: '이미지 분류 v2',
    trainName: 'ResNet50 파인튜닝',
    requester: '김철수',
    status: 'Running',
    trainMode: '분산 학습',
    gpuCount: 4,
    createdAt: '2026-05-15 09:12',
  },
  {
    runId: 'run-20240101-002',
    projectName: '텍스트 감성 분석',
    trainName: 'BERT 사전학습',
    requester: '이영희',
    status: 'Queued',
    trainMode: '단일 GPU',
    gpuCount: 1,
    createdAt: '2026-05-15 09:45',
  },
  {
    runId: 'run-20240101-003',
    projectName: '객체 탐지 YOLOv8',
    trainName: 'COCO 데이터셋 학습',
    requester: '박민준',
    status: 'Succeeded',
    trainMode: '분산 학습',
    gpuCount: 8,
    createdAt: '2026-05-14 14:30',
  },
  {
    runId: 'run-20240101-004',
    projectName: '음성 인식 모델',
    trainName: 'Whisper 파인튜닝',
    requester: '최수진',
    status: 'Failed',
    trainMode: '단일 GPU',
    gpuCount: 2,
    createdAt: '2026-05-14 11:00',
  },
  {
    runId: 'run-20240101-005',
    projectName: '추천 시스템',
    trainName: 'Collaborative Filtering',
    requester: '정다은',
    status: 'Canceled',
    trainMode: 'CPU 전용',
    gpuCount: 0,
    createdAt: '2026-05-13 16:20',
  },
  {
    runId: 'run-20240101-006',
    projectName: '이미지 생성 모델',
    trainName: 'Stable Diffusion 학습',
    requester: '김철수',
    status: 'Running',
    trainMode: '분산 학습',
    gpuCount: 8,
    createdAt: '2026-05-15 08:00',
  },
  {
    runId: 'run-20240101-007',
    projectName: '자연어 처리 QA',
    trainName: 'T5 파인튜닝',
    requester: '이영희',
    status: 'Queued',
    trainMode: '단일 GPU',
    gpuCount: 1,
    createdAt: '2026-05-15 10:05',
  },
  {
    runId: 'run-20240101-008',
    projectName: 'LLM 파인튜닝',
    trainName: 'LLaMA3 LoRA 학습',
    requester: '박민준',
    status: 'Succeeded',
    trainMode: '분산 학습',
    gpuCount: 8,
    createdAt: '2026-05-13 10:00',
  },
  {
    runId: 'run-20240101-009',
    projectName: '시계열 예측',
    trainName: 'Transformer 시계열',
    requester: '정다은',
    status: 'Running',
    trainMode: '단일 GPU',
    gpuCount: 1,
    createdAt: '2026-05-15 11:30',
  },
  {
    runId: 'run-20240101-010',
    projectName: '이상 탐지',
    trainName: 'AutoEncoder 학습',
    requester: '최수진',
    status: 'Queued',
    trainMode: 'CPU 전용',
    gpuCount: 0,
    createdAt: '2026-05-15 12:00',
  },
  {
    runId: 'run-20240101-011',
    projectName: '멀티모달',
    trainName: 'CLIP 파인튜닝',
    requester: '김철수',
    status: 'Failed',
    trainMode: '분산 학습',
    gpuCount: 4,
    createdAt: '2026-05-12 09:00',
  },
  {
    runId: 'run-20240101-012',
    projectName: '번역 모델',
    trainName: 'NLLB 파인튜닝',
    requester: '이영희',
    status: 'Succeeded',
    trainMode: '단일 GPU',
    gpuCount: 2,
    createdAt: '2026-05-11 15:20',
  },
]

function StatusBadge({ status }: { status: TrainStatus }) {
  const config: Record<
    TrainStatus,
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }
  > = {
    Queued: { variant: 'outline', className: 'border-yellow-400 text-yellow-600 dark:text-yellow-400' },
    Running: { variant: 'default', className: 'bg-blue-500 hover:bg-blue-500 text-white border-transparent' },
    Succeeded: { variant: 'default', className: 'bg-green-500 hover:bg-green-500 text-white border-transparent' },
    Failed: { variant: 'destructive', className: '' },
    Canceled: { variant: 'secondary', className: 'text-muted-foreground' },
  }
  const { variant, className } = config[status]
  return <Badge variant={variant} className={className}>{status}</Badge>
}

async function fetchJobs(): Promise<TrainJob[]> {
  const KFP_API = process.env.KFP_API
  const KUBE_TOKEN = process.env.KFP_TOKEN ?? process.env.KUBE_TOKEN

  try {
    if (!KFP_API) throw new Error('KFP_API not configured')

    const res = await fetch(`${KFP_API}/runs?page_size=50`, {
      headers: { Authorization: KUBE_TOKEN ?? '', 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(1000),
      cache: 'no-store',
    })

    if (!res.ok) throw new Error(`KFP API error: ${res.status}`)

    const data = await res.json()
    return (data.runs ?? []).map((run: Record<string, unknown>) => ({
      runId: run.run_id as string,
      projectName: (run.display_name as string)?.split('/')[0] ?? '—',
      trainName: run.display_name as string,
      requester: (run.service_account as string) ?? '—',
      status: mapKfpStatus(run.state as string),
      trainMode: '분산 학습' as TrainMode,
      gpuCount: 0,
      createdAt: formatDate(run.created_at as string),
    }))
  } catch {
    console.log('[KFP] fallback to dummy data')
    return dummyJobs
  }
}

function mapKfpStatus(state: string): TrainStatus {
  const map: Record<string, TrainStatus> = {
    RUNTIME_STATE_UNSPECIFIED: 'Queued',
    PENDING: 'Queued',
    RUNNING: 'Running',
    SUCCEEDED: 'Succeeded',
    FAILED: 'Failed',
    CANCELING: 'Canceled',
    CANCELED: 'Canceled',
    PAUSED: 'Queued',
  }
  return map[state] ?? 'Queued'
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const PAGE_SIZE = 10

export default async function TrainPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; mode?: string; from?: string; to?: string; page?: string }>
}) {
  const { q, status, mode, from, to, page: pageParam } = await searchParams
  const allJobs = await fetchJobs()

  const filtered = allJobs.filter(job => {
    if (q && !`${job.projectName} ${job.trainName} ${job.requester}`.toLowerCase().includes(q.toLowerCase())) return false
    if (status && status !== 'all' && job.status !== status) return false
    if (mode && mode !== 'all' && job.trainMode !== mode) return false
    if (from && job.createdAt < from) return false
    if (to && job.createdAt.slice(0, 10) > to) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const currentPage = Math.min(Math.max(1, Number(pageParam ?? 1)), totalPages || 1)
  const jobs = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const statusCount = allJobs.reduce(
    (acc, job) => { acc[job.status] = (acc[job.status] ?? 0) + 1; return acc },
    {} as Record<TrainStatus, number>
  )

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    if (mode) params.set('mode', mode)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    params.set('page', String(p))
    return `/dashboard/train?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">학습 실행</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          GPU 학습 작업을 요청하고 현황을 모니터링하세요.
        </p>
      </div>

      {/* 상태 요약 배지 모음 */}
      <div className="flex flex-wrap gap-3">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>전체 {allJobs.length}건</span>
        </div>
        {(['Running', 'Queued', 'Succeeded', 'Failed', 'Canceled'] as TrainStatus[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <StatusBadge status={s} />
            <span className="text-muted-foreground text-sm">{statusCount[s] ?? 0}</span>
          </div>
        ))}
      </div>

      {/* 학습 요청 목록 테이블 */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="shrink-0">
              <CardTitle className="text-base">학습 요청 목록</CardTitle>
              <CardDescription className="text-xs">
                최근 학습 실행 요청 이력입니다.
              </CardDescription>
            </div>
            <Suspense fallback={null}>
              <TrainSearchFilter />
            </Suspense>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run ID</TableHead>
                <TableHead>프로젝트명</TableHead>
                <TableHead>학습명</TableHead>
                <TableHead>요청자</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>학습 모드</TableHead>
                <TableHead className="text-right">GPU 개수</TableHead>
                <TableHead>요청 시각</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground py-10 text-center text-sm">
                    검색 결과가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map(job => (
                  <TableRow key={job.runId} className="hover:bg-muted/50 cursor-pointer">
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      <Link
                        href={`/dashboard/train/${job.runId}`}
                        className="hover:text-foreground underline-offset-4 transition-colors hover:underline"
                      >
                        {job.runId}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/train/${job.runId}`} className="underline-offset-4 hover:underline">
                        {job.projectName}
                      </Link>
                    </TableCell>
                    <TableCell>{job.trainName}</TableCell>
                    <TableCell>{job.requester}</TableCell>
                    <TableCell><StatusBadge status={job.status} /></TableCell>
                    <TableCell>{job.trainMode}</TableCell>
                    <TableCell className="text-right">{job.gpuCount > 0 ? job.gpuCount : '-'}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{job.createdAt}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="border-t py-3 flex flex-col items-center gap-1">
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === 1} asChild={currentPage !== 1}>
                  {currentPage !== 1 ? (
                    <Link href={pageUrl(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Link>
                  ) : (
                    <span><ChevronLeft className="h-4 w-4" /></span>
                  )}
                </Button>
                {(() => {
                  const SHOW = 5
                  let start = Math.max(1, currentPage - Math.floor(SHOW / 2))
                  const end = Math.min(totalPages, start + SHOW - 1)
                  start = Math.max(1, end - SHOW + 1)
                  return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(p => (
                    <Button
                      key={p}
                      variant={p === currentPage ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 w-7 p-0 text-xs"
                      asChild={p !== currentPage}
                    >
                      {p !== currentPage ? <Link href={pageUrl(p)}>{p}</Link> : <span>{p}</span>}
                    </Button>
                  ))
                })()}
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === totalPages} asChild={currentPage !== totalPages}>
                  {currentPage !== totalPages ? (
                    <Link href={pageUrl(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Link>
                  ) : (
                    <span><ChevronRight className="h-4 w-4" /></span>
                  )}
                </Button>
              </div>
              <span className="text-muted-foreground text-xs">
                총 {filtered.length}건
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
