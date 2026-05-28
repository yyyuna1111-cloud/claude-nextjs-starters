import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

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

export interface EvalHistoryEntry {
  rcId: string
  rcVersion: string
  evaluatedAt: string
  ragasScore: number
  passRate: number
  gate: 'Pass' | 'Fail'
}

function historyKey(datasetKey: string) {
  // eval-history/eval-dataset%2FFAQ%2F...json
  return `eval-history/${encodeURIComponent(datasetKey)}.json`
}

// GET /api/eval-dataset/history?key=...
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key 없음' }, { status: 400 })

  try {
    const res = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: historyKey(key),
    }))
    const body = await res.Body?.transformToString()
    const entries: EvalHistoryEntry[] = body ? JSON.parse(body) : []
    return NextResponse.json({ entries })
  } catch (err: unknown) {
    // 파일이 없으면 빈 배열 반환
    if (err && typeof err === 'object' && 'name' in err && err.name === 'NoSuchKey') {
      return NextResponse.json({ entries: [] })
    }
    return NextResponse.json({ entries: [] })
  }
}

// POST /api/eval-dataset/history?key=...
// body: EvalHistoryEntry
export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key 없음' }, { status: 400 })

  const entry: EvalHistoryEntry = await req.json()
  const hKey = historyKey(key)

  // 기존 이력 조회
  let entries: EvalHistoryEntry[] = []
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: hKey }))
    const body = await res.Body?.transformToString()
    entries = body ? JSON.parse(body) : []
  } catch {
    // 없으면 새로 생성
  }

  // 중복 방지 (같은 rcId 이미 존재하면 스킵)
  if (entries.some(e => e.rcId === entry.rcId)) {
    return NextResponse.json({ ok: true, entries, duplicate: true })
  }

  // 맨 앞에 추가 (최신순)
  entries.unshift(entry)

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: hKey,
    Body: JSON.stringify(entries, null, 2),
    ContentType: 'application/json',
  }))

  return NextResponse.json({ ok: true, entries })
}