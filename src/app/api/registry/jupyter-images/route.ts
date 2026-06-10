import { NextResponse } from 'next/server'

const REGISTRY = process.env.DOCKER_REGISTRY_URL ?? 'http://10.70.170.227'
const REGISTRY_HOST = REGISTRY.replace(/^https?:\/\//, '')
const JUPYTER_PREFIX = process.env.JUPYTER_IMAGE_PREFIX ?? 'jupyter'

export async function GET() {
  try {
    const res = await fetch(`${REGISTRY}/v2/_catalog?n=500`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`Registry ${res.status}`)

    const data = await res.json()
    const repos: string[] = (data.repositories ?? []).filter((r: string) =>
      r.startsWith(`${JUPYTER_PREFIX}/`)
    )

    const imageGroups = await Promise.all(
      repos.map(async (repo) => {
        try {
          const tagsRes = await fetch(`${REGISTRY}/v2/${repo}/tags/list`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
            next: { revalidate: 0 },
          })
          if (!tagsRes.ok) return []
          const tagsData = await tagsRes.json()
          return (tagsData.tags ?? []).map((tag: string) => ({
            label: `${repo}:${tag}`,
            value: `${REGISTRY_HOST}/${repo}:${tag}`,
          }))
        } catch {
          return []
        }
      })
    )

    return NextResponse.json({ images: imageGroups.flat() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Registry 연결 실패'
    return NextResponse.json({ images: [], error: message })
  }
}
