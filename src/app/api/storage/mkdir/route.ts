import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const FILER_URL = process.env.SEAWEEDFS_FILER_URL ?? 'http://10.70.171.177:31994'
const NFS_SLLM_PATH = '/mnt/sllm'

function safePath(base: string, ...parts: string[]): string {
  const resolved = path.resolve(base, ...parts)
  if (!resolved.startsWith(path.resolve(base))) throw new Error('Invalid path')
  return resolved
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

    if (bucket === 'shared-sllm') {
      const dirPath = safePath(NFS_SLLM_PATH, (prefix ?? '') + name)
      fs.mkdirSync(dirPath, { recursive: true })
      return NextResponse.json({ success: true })
    }

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
