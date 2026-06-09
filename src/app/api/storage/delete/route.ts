/* eslint-disable @typescript-eslint/no-explicit-any */
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

export async function DELETE(req: NextRequest) {
  const bucket = req.nextUrl.searchParams.get('bucket')
  const key = req.nextUrl.searchParams.get('key')

  if (!bucket || !key) {
    return NextResponse.json({ error: 'bucket과 key가 필요합니다' }, { status: 400 })
  }

  if (bucket === 'shared-sllm') {
    try {
      const filePath = safePath(NFS_SLLM_PATH, key)
      fs.unlinkSync(filePath)
      return NextResponse.json({ success: true })
    } catch (err: any) {
      console.error('[Storage Delete NFS]', err.message)
      return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
    }
  }

  try {
    const filePath = `/buckets/${bucket}/${key}`
    const res = await fetch(`${FILER_URL}${filePath}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Filer 삭제 실패: ${res.status}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Storage Delete]', err.message)
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
  }
}
