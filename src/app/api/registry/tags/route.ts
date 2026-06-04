/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

const REGISTRY = process.env.DOCKER_REGISTRY_URL ?? 'http://10.70.170.227'

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name 파라미터 필요' }, { status: 400 })

  try {
    const res = await fetch(`${REGISTRY}/v2/${name}/tags/list`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 0 },
    })

    if (!res.ok) throw new Error(`Registry ${res.status}`)

    const data = await res.json()
    const tags: string[] = (data.tags ?? []).reverse() // 최신순

    return NextResponse.json({ name, tags, total: tags.length })
  } catch (err: any) {
    console.error('[Registry Tags]', err.message)
    return NextResponse.json({ name, tags: [], total: 0, error: err.message })
  }
}
