// POST /api/scraping/trigger
// Argo Workflows에 scraping workflow를 submit합니다.
// 사내망 전용 - Authorization 헤더 불필요

import { NextResponse } from 'next/server'

const ARGO = process.env.ARGO // http://localhost:30337

export async function POST(req: Request) {
  if (!ARGO) {
    return NextResponse.json(
      { error: 'ARGO 환경변수가 설정되지 않았습니다.' },
      { status: 500 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const params: Record<string, string> = body.parameters ?? {}

  // WorkflowTemplate 'tax-pipeline' 으로 submit
  const res = await fetch(`${ARGO}/api/v1/workflows/argo/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resourceKind: 'WorkflowTemplate',
      resourceName: 'tax-pipeline-secret',
      submitOptions: {

        parameters: Object.entries(params).map(([k, v]) => `${k}=${v}`),
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return NextResponse.json(
      { error: `Argo 트리거 실패: ${res.status} ${text}` },
      { status: res.status }
    )
  }

  const data = await res.json()
  return NextResponse.json({ ok: true, workflow: data })
}
