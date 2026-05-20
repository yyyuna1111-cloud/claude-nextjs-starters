// GET /api/train/runs/[runId]
// KFP API에서 특정 run 상세 조회, 실패 시 더미 데이터 반환

import { NextResponse } from 'next/server'

const KFP_API = process.env.KFP_API
const KUBE_TOKEN = process.env.KFP_TOKEN ?? process.env.KUBE_TOKEN

function mapKfpState(state: string): string {
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

function mapTaskState(state: string): string {
  const map: Record<string, string> = {
    RUNTIME_STATE_UNSPECIFIED: 'pending',
    PENDING: 'pending',
    RUNNING: 'running',
    SUCCEEDED: 'completed',
    FAILED: 'failed',
    CANCELING: 'failed',
    CANCELED: 'failed',
    PAUSED: 'pending',
  }
  return map[state] ?? 'pending'
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params

  try {
    if (!KFP_API) throw new Error('KFP_API not configured')

    const res = await fetch(`${KFP_API}/runs/${runId}`, {
      headers: {
        Authorization: KUBE_TOKEN ?? '',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    })

    if (!res.ok) throw new Error(`KFP API error: ${res.status}`)

    const data = await res.json()

    const tasks = (data.run_details?.task_details ?? []).map(
      (t: Record<string, unknown>) => ({
        name: t.display_name as string,
        state: mapTaskState(t.state as string),
        startedAt: t.start_time ?? null,
        finishedAt: t.end_time ?? null,
      })
    )

    return NextResponse.json({
      run: {
        runId: data.run_id,
        displayName: data.display_name,
        state: mapKfpState(data.state),
        createdAt: data.created_at,
        finishedAt: data.finished_at ?? null,
        tasks,
      },
      source: 'kfp',
    })
  } catch {
    return NextResponse.json({
      run: {
        runId,
        displayName: 'ResNet50 파인튜닝',
        state: 'Running',
        createdAt: '2026-05-15T09:12:00Z',
        finishedAt: null,
        tasks: [
          {
            name: 'Prepare',
            state: 'completed',
            startedAt: '2026-05-15T09:12:00Z',
            finishedAt: '2026-05-15T09:15:00Z',
          },
          {
            name: 'Train',
            state: 'running',
            startedAt: '2026-05-15T09:15:00Z',
            finishedAt: null,
          },
          {
            name: 'Evaluate',
            state: 'pending',
            startedAt: null,
            finishedAt: null,
          },
          {
            name: 'Register',
            state: 'pending',
            startedAt: null,
            finishedAt: null,
          },
        ],
      },
      source: 'dummy',
    })
  }
}
