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

function resolveNfsDir(bucket: string, prefix: string): string | null {
  if (bucket in NFS_ROOTS) return safePath(NFS_ROOTS[bucket], prefix)
  if (!bucket.startsWith('shared-')) return safePath('/mnt/sllm', bucket, prefix)
  return null
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const bucket = formData.get('bucket') as string | null
    const prefix = (formData.get('prefix') as string) ?? ''

    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
    if (!bucket) return NextResponse.json({ error: 'bucket이 필요합니다' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    const nfsDir = resolveNfsDir(bucket, prefix)
    if (nfsDir !== null) {
      fs.mkdirSync(nfsDir, { recursive: true })
      fs.writeFileSync(path.join(nfsDir, file.name), buffer)
      return NextResponse.json({ success: true, key: `${prefix}${file.name}`, name: file.name, bucket })
    }

    // SeaweedFS fallback (레거시)
    const FILER_URL = process.env.SEAWEEDFS_FILER_URL ?? 'http://10.70.171.177:31994'
    const filePath = `/buckets/${bucket}/${prefix}${file.name}`
    const res = await fetch(`${FILER_URL}${filePath}`, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: buffer,
      signal: AbortSignal.timeout(60000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Filer 업로드 실패: ${res.status}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, key: `${prefix}${file.name}`, name: file.name, bucket })
  } catch (err: any) {
    console.error('[Storage Upload]', err.message)
    return NextResponse.json({ error: '업로드 실패' }, { status: 500 })
  }
}
