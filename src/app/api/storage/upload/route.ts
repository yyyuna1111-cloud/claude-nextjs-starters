/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

const FILER_URL = process.env.SEAWEEDFS_FILER_URL ?? 'http://10.70.171.177:31994'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const bucket = formData.get('bucket') as string | null
    const prefix = (formData.get('prefix') as string) ?? ''

    if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
    if (!bucket) return NextResponse.json({ error: 'bucket이 필요합니다' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
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
