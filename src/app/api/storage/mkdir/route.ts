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

export async function POST(req: NextRequest) {
  try {
    const { bucket, prefix, name } = await req.json()

    if (!bucket || !name) {
      return NextResponse.json({ error: 'bucket과 name이 필요합니다' }, { status: 400 })
    }
    if (!/^[^/\\:*?"<>|]+$/.test(name)) {
      return NextResponse.json({ error: '유효하지 않은 폴더 이름입니다' }, { status: 400 })
    }

    const nfsPath = resolveNfsPath(bucket, (prefix ?? '') + name)
    if (nfsPath !== null) {
      fs.mkdirSync(nfsPath, { recursive: true })
      return NextResponse.json({ success: true })
    }

    // SeaweedFS fallback (레거시)
    const FILER_URL = process.env.SEAWEEDFS_FILER_URL ?? 'http://10.70.171.177:31994'
    const dirPath = `/buckets/${bucket}/${prefix ?? ''}${name}/`
    const res = await fetch(`${FILER_URL}${dirPath}`, {
      method: 'POST',
      headers: { 'Content-Length': '0' },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok && res.status !== 404) {
      return NextResponse.json({ error: `Filer 오류: ${res.status}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[Storage Mkdir]', err)
    return NextResponse.json({ error: '폴더 생성 실패' }, { status: 500 })
  }
}
