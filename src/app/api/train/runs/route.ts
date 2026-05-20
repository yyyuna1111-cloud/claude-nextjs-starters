// GET /api/train/runs
// KFP API에서 run 목록 조회, 실패 시 더미 데이터 반환

import { NextResponse } from 'next/server'

const KFP_API = process.env.KFP_API // http://10.70.171.92:31380/pipeline/apis/v2beta1
const KUBE_TOKEN = process.env.KFP_TOKEN ?? process.env.KUBE_TOKEN

// KFP 연결 불가 시 fallback 더미 데이터
const DUMMY_RUNS = [
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
]

export async function GET() {
  try {
    if (!KFP_API) throw new Error('KFP_API not configured')

    const res = await fetch(`${KFP_API}/runs?page_size=50`, {
      headers: {
        Authorization: KUBE_TOKEN ?? '',
        'Content-Type': 'application/json',
      },
      // VM 내부망에서만 접근 가능하므로 로컬 개발 시 타임아웃 빠르게
      signal: AbortSignal.timeout(500),
    })

    if (!res.ok) throw new Error(`KFP API error: ${res.status}`)

    const data = await res.json()

    // KFP 응답을 대시보드 형식으로 변환
    const runs = (data.runs ?? []).map((run: Record<string, unknown>) => ({
      runId: run.run_id,
      projectName: (run.display_name as string)?.split('/')[0] ?? '—',
      trainName: run.display_name,
      requester: (run.service_account as string) ?? '—',
      status: mapKfpStatus(run.state as string),
      trainMode: '분산 학습',
      gpuCount: 0,
      createdAt: formatDate(run.created_at as string),
    }))

    return NextResponse.json({ runs, source: 'kfp' })
  } catch {
    // KFP 연결 실패 시 더미 데이터 반환 (로컬 개발용)
    return NextResponse.json({ runs: DUMMY_RUNS, source: 'dummy' })
  }
}

function mapKfpStatus(state: string): string {
  const map: Record<string, string> = {
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
