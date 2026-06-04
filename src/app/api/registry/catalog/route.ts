/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'

const REGISTRY = process.env.DOCKER_REGISTRY_URL ?? 'http://10.70.170.227'

export async function GET() {
  try {
    // Registry v2 API — 전체 레포 목록 (n=1000으로 페이지 없이 한번에)
    const res = await fetch(`${REGISTRY}/v2/_catalog?n=1000`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 0 },
    })

    if (!res.ok) throw new Error(`Registry ${res.status}`)

    const data = await res.json()
    const repositories: string[] = (data.repositories ?? []).sort()

    return NextResponse.json({ repositories, total: repositories.length })
  } catch (err: any) {
    console.error('[Registry Catalog]', err.message)
    return NextResponse.json({ repositories: [], total: 0, error: err.message })
  }
}
