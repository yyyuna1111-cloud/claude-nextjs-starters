// DELETE /api/scraping/workflows/[name]/delete
import { NextResponse } from 'next/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const res = await fetch(
    `${process.env.ARGO}/api/v1/workflows/argo/${name}`,
    { method: 'DELETE' }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return NextResponse.json({ error: text }, { status: res.status })
  }
  return NextResponse.json({ ok: true })
}