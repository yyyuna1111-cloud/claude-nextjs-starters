import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
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

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json()
    if (!name) return NextResponse.json({ error: '폴더명이 없습니다.' }, { status: 400 })

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `eval-dataset/${name}/.keep`,
      Body: '',
    }))

    return NextResponse.json({ success: true, name })
  } catch (err) {
    console.error('Folder create error:', err)
    return NextResponse.json({ error: '폴더 생성 실패' }, { status: 500 })
  }
}