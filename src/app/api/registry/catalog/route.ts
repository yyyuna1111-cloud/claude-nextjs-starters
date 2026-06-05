/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'

const REGISTRY = process.env.DOCKER_REGISTRY_URL ?? 'http://10.70.170.227'

export async function GET() {
  try {
    const all: string[] = []
    let url: string | null = `${REGISTRY}/v2/_catalog?n=500`

    while (url) {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
        next: { revalidate: 0 },
      })
      if (!res.ok) throw new Error(`Registry ${res.status}`)

      const data = await res.json()
      all.push(...(data.repositories ?? []))

      // Link 헤더로 다음 페이지 확인
      const link = res.headers.get('Link')
      if (link) {
        const match = link.match(/<([^>]+)>;\s*rel="next"/)
        url = match ? `${REGISTRY}${match[1]}` : null
      } else {
        url = null
      }
    }

    const repositories = all
      .filter(r => !r.startsWith('jupyterhub'))
      .sort()

    return NextResponse.json({ repositories, total: repositories.length })
  } catch (err: any) {
    console.error('[Registry Catalog]', err.message)
    return NextResponse.json({ repositories: [], total: 0, error: err.message })
  }
}
