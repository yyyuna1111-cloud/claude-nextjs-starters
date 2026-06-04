// GET /api/scraping/data?limit=50
// SeaweedFS S3에서 output/tax_data.jsonl 파일을 읽어 최근 N건 반환합니다.
// 실패 시 빈 배열 fallback

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT, // http://localhost:30400
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.SEAWEEDFS_ACCESS_KEY ?? 'any',
    secretAccessKey: process.env.SEAWEEDFS_SECRET_KEY ?? 'any',
  },
  forcePathStyle: true, // SeaweedFS S3 호환 모드
})

const BUCKET = process.env.S3_BUCKET ?? 'tax'

export async function GET(request: NextRequest) {
  // query param으로 조회 건수 제한 (기본 50)
  const { searchParams } = request.nextUrl
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  try {
    const cmd = new GetObjectCommand({
      Bucket: BUCKET,
      Key: 'output/tax_data.jsonl',
    })

    const res = await s3.send(cmd)

    // Body를 문자열로 변환
    const bodyText = await res.Body?.transformToString('utf-8')
    if (!bodyText) return NextResponse.json({ rows: [] })

    // JSONL 파싱: 줄 단위로 JSON.parse, 빈 줄 제외
    const rows = bodyText
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(row => row !== null)

    const total = rows.length
    // 최근 limit건 반환 (뒤에서부터 slice)
    const recent = limit === 0 ? rows : rows.slice(-limit)

    return NextResponse.json({ rows: recent, total })
  } catch (e) {
    console.error('[S3 data] fallback to empty:', e)
    return NextResponse.json({ rows: [] })
  }
}
