// POST /api/scraping/trigger
// Argo Workflows에 scraping workflow를 submit합니다.
// 사내망 전용 - Authorization 헤더 불필요

import { NextResponse } from 'next/server'

const ARGO = process.env.ARGO // http://localhost:30337

export async function POST() {
  if (!ARGO) {
    return NextResponse.json(
      { error: 'ARGO 환경변수가 설정되지 않았습니다.' },
      { status: 500 }
    )
  }

  // Argo workflow submit 요청 - 최소한의 body로 submit
  const res = await fetch(`${ARGO}/api/v1/workflows/argo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ namespace: 'argo' }),
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
