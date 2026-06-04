// GET /api/scraping/runs
// SeaweedFS S3에서 runs/ 폴더 파일 목록을 조회합니다.
// 실패 시 빈 배열 fallback

import { NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'

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

export async function GET() {
  try {
    const listRes = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'runs/' }))
    const objects = (listRes.Contents ?? []).filter(o => o.Key?.endsWith('.json'))

    const runs = await Promise.all(
      objects.map(async obj => {
        try {
          const getRes = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key! }))
          const text = await getRes.Body?.transformToString('utf-8') ?? '{}'
          const data = JSON.parse(text)
          return { key: obj.Key!, lastModified: obj.LastModified?.toISOString() ?? null, ...data }
        } catch {
          return { key: obj.Key!, lastModified: obj.LastModified?.toISOString() ?? null }
        }
      })
    )

    runs.sort((a, b) => new Date(b.lastModified ?? 0).getTime() - new Date(a.lastModified ?? 0).getTime())
    return NextResponse.json({ runs })
  } catch (e) {
    console.error('[S3 runs] fallback to empty:', e)
    return NextResponse.json({ runs: [] })
  }
}
