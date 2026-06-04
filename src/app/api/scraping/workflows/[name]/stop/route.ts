// PUT /api/scraping/workflows/[name]/stop
import { NextResponse } from 'next/server'

export async function PUT(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const res = await fetch(
    `${process.env.ARGO}/api/v1/workflows/argo/${name}/stop`,
    { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return NextResponse.json({ error: text }, { status: res.status })
  }
  return NextResponse.json({ ok: true })
}