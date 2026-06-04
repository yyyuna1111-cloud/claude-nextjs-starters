// GET /api/scraping/runs
// SeaweedFS S3에서 runs/ 폴더 파일 목록을 조회합니다.
// 실패 시 빈 배열 fallback

import { NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

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
    const cmd = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: 'runs/',
    })

    const res = await s3.send(cmd)
    // Contents가 없으면 빈 배열 반환
    const files = (res.Contents ?? []).map(obj => ({
      key: obj.Key ?? '',
      size: obj.Size ?? 0,
      lastModified: obj.LastModified?.toISOString() ?? null,
    }))

    return NextResponse.json({ files })
  } catch (e) {
    console.error('[S3 runs] fallback to empty:', e)
    return NextResponse.json({ files: [] })
  }
}
