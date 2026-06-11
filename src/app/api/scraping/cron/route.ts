// GET /api/scraping/cron
// Argo CronWorkflow 목록을 반환합니다.

import { NextResponse } from 'next/server'

const ARGO = process.env.ARGO

export async function GET() {
  if (!ARGO) {
    return NextResponse.json({ error: 'ARGO 환경변수 없음' }, { status: 500 })
  }

  const res = await fetch(`${ARGO}/api/v1/cron-workflows/argo`, { cache: 'no-store' })
  if (!res.ok) {
    return NextResponse.json({ error: `Argo CronWorkflow 조회 실패: ${res.status}` }, { status: res.status })
  }

  const data = await res.json()
  const items = (data.items ?? []).map((item: Record<string, unknown>) => {
    const spec = item.spec as Record<string, unknown>
    const status = item.status as Record<string, unknown>
    const metadata = item.metadata as Record<string, unknown>
    return {
      name: metadata.name,
      schedules: spec.schedules,
      timezone: spec.timezone ?? 'UTC',
      phase: (status.phase as string) ?? 'Unknown',
      lastScheduledTime: status.lastScheduledTime ?? null,
      succeeded: status.succeeded ?? 0,
      failed: status.failed ?? 0,
      concurrencyPolicy: spec.concurrencyPolicy,
    }
  })

  return NextResponse.json({ items })
}