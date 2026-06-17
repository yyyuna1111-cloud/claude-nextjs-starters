/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const NFS_ROOTS: Record<string, string> = {
  'shared-sllm': '/mnt/sllm',
  'ds-nfs': '/mnt/ds',
}

function safePath(base: string, ...parts: string[]): string {
  const resolved = path.resolve(base, ...parts)
  if (!resolved.startsWith(path.resolve(base))) throw new Error('Invalid path')
  return resolved
}

function resolveNfsPath(bucket: string, ...parts: string[]): string | null {
  if (bucket in NFS_ROOTS) return safePath(NFS_ROOTS[bucket], ...parts)
  if (!bucket.startsWith('shared-')) return safePath('/mnt/sllm', bucket, ...parts)
  return null
}

export async function GET(req: NextRequest) {
  const bucket = req.nextUrl.searchParams.get('bucket')
  const key = req.nextUrl.searchParams.get('key')

  if (!bucket || !key) {
    return NextResponse.json({ error: 'bucket과 key가 필요합니다' }, { status: 400 })
  }

  const nfsPath = resolveNfsPath(bucket, key)
  if (nfsPath !== null) {
    try {
      const buffer = fs.readFileSync(nfsPath)
      const filename = key.split('/').pop() ?? 'download'
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      })
    } catch (err: any) {
      console.error('[Storage Download NFS]', err.message)
      return NextResponse.json({ error: '다운로드 실패' }, { status: 500 })
    }
  }

  // SeaweedFS fallback (레거시)
  const FILER_URL = process.env.SEAWEEDFS_FILER_URL ?? 'http://10.70.171.177:31994'
  try {
    const filePath = `/buckets/${bucket}/${key}`
    const res = await fetch(`${FILER_URL}${filePath}`, {
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Filer ${res.status}` }, { status: res.status })
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    const filename = key.split('/').pop() ?? 'download'
    const contentType = res.headers.get('Content-Type') ?? 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (err: any) {
    console.error('[Storage Download]', err.message)
    return NextResponse.json({ error: '다운로드 실패' }, { status: 500 })
  }
}
