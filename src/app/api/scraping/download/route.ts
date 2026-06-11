// GET /api/scraping/download?format=csv|json|jsonl
// S3 output/tax_data.jsonl 전체를 다운로드합니다.

import { NextRequest } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.SEAWEEDFS_ACCESS_KEY ?? 'any',
    secretAccessKey: process.env.SEAWEEDFS_SECRET_KEY ?? 'any',
  },
  forcePathStyle: true,
})

const BUCKET = process.env.S3_BUCKET ?? 'tax'

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get('format') ?? 'csv'

  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: 'output/tax1_data.jsonl' })
  const res = await s3.send(cmd)
  const bodyText = await res.Body?.transformToString('utf-8') ?? ''

  const rows = bodyText
    .split('\n')
    .filter(l => l.trim())
    .map(l => { try { return JSON.parse(l) } catch { return null } })
    .filter((r): r is Record<string, unknown> => r !== null)

  if (format === 'jsonl') {
    return new Response(bodyText, {
      headers: {
        'Content-Type': 'application/jsonl',
        'Content-Disposition': 'attachment; filename="tax_data.jsonl"',
      },
    })
  }

  if (format === 'json') {
    return new Response(JSON.stringify(rows, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="tax_data.json"',
      },
    })
  }

  // CSV (기본)
  if (rows.length === 0) {
    return new Response('', {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="tax_data.csv"',
      },
    })
  }
  const cols = Object.keys(rows[0])
  const csv = [
    cols.join(','),
    ...rows.map(row => cols.map(c => JSON.stringify(row[c] ?? '')).join(',')),
  ].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tax_data.csv"',
    },
  })
}