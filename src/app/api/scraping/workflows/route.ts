// GET /api/scraping/workflows
// Argo Workflows에서 workflow 목록을 조회합니다.
// 실패 시 빈 배열 fallback

import { NextResponse } from 'next/server'

const ARGO = process.env.ARGO // http://localhost:30337

export async function GET() {
  try {
    if (!ARGO) throw new Error('ARGO 환경변수가 설정되지 않았습니다.')

    const res = await fetch(`${ARGO}/api/v1/workflows/argo`, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    })

    if (!res.ok) throw new Error(`Argo API error: ${res.status}`)

    const data = await res.json()
    // Argo 응답: { items: [...] } 또는 { items: null }
    const workflows = data.items ?? []

    return NextResponse.json({ workflows })
  } catch (e) {
    console.error('[Argo workflows] fallback to empty:', e)
    return NextResponse.json({ workflows: [] })
  }
}
