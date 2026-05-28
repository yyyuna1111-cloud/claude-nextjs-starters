import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const s3 = new S3Client({
  endpoint: process.env.SEAWEEDFS_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.SEAWEEDFS_ACCESS_KEY ?? 'admin',
    secretAccessKey: process.env.SEAWEEDFS_SECRET_KEY ?? 'skyadmin',
  },
  forcePathStyle: true,
})

const BUCKET = process.env.SEAWEEDFS_BUCKET ?? 'mlpipeline'

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key 없음' }, { status: 400 })

  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0', 10)
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10)

  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const chunks: Uint8Array[] = []
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    const wb = XLSX.read(buffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const allRows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)
    const total = allRows.length
    const rows = allRows.slice(offset, offset + limit)

    return NextResponse.json({ rows, total, offset, limit })
  } catch (err) {
    console.error('Preview error:', err)
    return NextResponse.json({ error: '미리보기 실패' }, { status: 500 })
  }
}