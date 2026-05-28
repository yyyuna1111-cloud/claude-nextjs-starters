import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
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

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  const name = req.nextUrl.searchParams.get('name') ?? 'download.xlsx'
  if (!key) return NextResponse.json({ error: 'key 없음' }, { status: 400 })

  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const chunks: Uint8Array[] = []
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
      },
    })
  } catch (err) {
    console.error('Download error:', err)
    return NextResponse.json({ error: '다운로드 실패' }, { status: 500 })
  }
}