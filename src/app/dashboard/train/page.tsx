// 학습 실행 페이지 - 서버 컴포넌트
// 학습 요청 목록을 테이블로 표시 (더미 데이터)

import type { Metadata } from 'next'
import Link from 'next/link'
import { PlusIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

// 학습 상태 타입 정의
type TrainStatus = 'Queued' | 'Running' | 'Succeeded' | 'Failed' | 'Canceled'

// 학습 모드 타입 정의
type TrainMode = '단일 GPU' | '분산 학습' | 'CPU 전용'

// 학습 요청 데이터 타입
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

// 더미 학습 요청 데이터
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
]

// 상태별 배지 스타일 및 레이블 매핑
function StatusBadge({ status }: { status: TrainStatus }) {
  const config: Record<
    TrainStatus,
    {
      variant: 'default' | 'secondary' | 'destructive' | 'outline'
      className: string
    }
  > = {
    Queued: {
      variant: 'outline',
      className: 'border-yellow-400 text-yellow-600 dark:text-yellow-400',
    },
    Running: {
      variant: 'default',
      className: 'bg-blue-500 hover:bg-blue-500 text-white border-transparent',
    },
    Succeeded: {
      variant: 'default',
      className:
        'bg-green-500 hover:bg-green-500 text-white border-transparent',
    },
    Failed: {
      variant: 'destructive',
      className: '',
    },
    Canceled: {
      variant: 'secondary',
      className: 'text-muted-foreground',
    },
  }

  const { variant, className } = config[status]

  return (
    <Badge variant={variant} className={className}>
      {status}
    </Badge>
  )
}

export default function TrainPage() {
  // 상태별 집계 (요약 수치 표시용)
  const statusCount = dummyJobs.reduce(
    (acc, job) => {
      acc[job.status] = (acc[job.status] ?? 0) + 1
      return acc
    },
    {} as Record<TrainStatus, number>
  )

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">학습 실행</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            GPU 학습 작업을 요청하고 현황을 모니터링하세요.
          </p>
        </div>
        <Button>
          <PlusIcon className="mr-2 size-4" />
          학습 요청
        </Button>
      </div>

      {/* 상태 요약 배지 모음 */}
      <div className="flex flex-wrap gap-3">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span>전체 {dummyJobs.length}건</span>
        </div>
        {(
          [
            'Running',
            'Queued',
            'Succeeded',
            'Failed',
            'Canceled',
          ] as TrainStatus[]
        ).map(status => (
          <div key={status} className="flex items-center gap-1.5">
            <StatusBadge status={status} />
            <span className="text-muted-foreground text-sm">
              {statusCount[status] ?? 0}
            </span>
          </div>
        ))}
      </div>

      {/* 학습 요청 목록 테이블 */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">학습 요청 목록</CardTitle>
          <CardDescription className="text-xs">
            최근 학습 실행 요청 이력입니다.
          </CardDescription>
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
              {dummyJobs.map(job => (
                <TableRow
                  key={job.runId}
                  className="hover:bg-muted/50 cursor-pointer"
                >
                  {/* Run ID - 상세 페이지 링크 + 모노스페이스 폰트 */}
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    <Link
                      href={`/dashboard/train/${job.runId}`}
                      className="hover:text-foreground underline-offset-4 transition-colors hover:underline"
                    >
                      {job.runId}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/train/${job.runId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {job.projectName}
                    </Link>
                  </TableCell>
                  <TableCell>{job.trainName}</TableCell>
                  <TableCell>{job.requester}</TableCell>
                  <TableCell>
                    <StatusBadge status={job.status} />
                  </TableCell>
                  <TableCell>{job.trainMode}</TableCell>
                  <TableCell className="text-right">
                    {/* GPU가 없는 경우 '-' 표시 */}
                    {job.gpuCount > 0 ? job.gpuCount : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {job.createdAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
