/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

const REGISTRY = process.env.DOCKER_REGISTRY_URL ?? 'http://10.70.170.227'

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  const tag = req.nextUrl.searchParams.get('tag')
  if (!name || !tag) return NextResponse.json({ error: 'name, tag 파라미터 필요' }, { status: 400 })

  try {
    // v2 manifest (이미지 크기·레이어 정보)
    const res = await fetch(`${REGISTRY}/v2/${name}/manifests/${tag}`, {
      headers: {
        Accept: 'application/vnd.docker.distribution.manifest.v2+json',
      },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 0 },
    })

    if (!res.ok) throw new Error(`Registry ${res.status}`)

    const digest = res.headers.get('Docker-Content-Digest') ?? ''
    const manifest = await res.json()

    // 전체 크기 = config + 레이어 합산
    const layers = manifest.layers ?? []
    const totalSize = layers.reduce((s: number, l: any) => s + (l.size ?? 0), 0)
      + (manifest.config?.size ?? 0)

    return NextResponse.json({
      name,
      tag,
      digest,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
      layerCount: layers.length,
      layers: layers.map((l: any, i: number) => ({
        index: i + 1,
        digest: l.digest,
        size: l.size,
        sizeFormatted: formatBytes(l.size),
        mediaType: l.mediaType,
      })),
      schemaVersion: manifest.schemaVersion,
      mediaType: manifest.mediaType,
    })
  } catch (err: any) {
    console.error('[Registry Manifest]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
