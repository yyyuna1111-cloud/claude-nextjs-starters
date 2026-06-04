// GET /api/scraping/workflows/[name]
// 특정 Argo workflow 상세 조회 (nodes 포함)

import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  try {
    const res = await fetch(
      `${process.env.ARGO}/api/v1/workflows/argo/${name}`,
      { cache: 'no-store' }
    )
    if (!res.ok) throw new Error(`Argo ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}