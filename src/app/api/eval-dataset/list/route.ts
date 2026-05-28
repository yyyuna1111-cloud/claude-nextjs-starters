import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { NextResponse } from 'next/server'

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

export async function GET() {
  try {
    const listRes = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: 'eval-dataset/',
    }))

    const objects = (listRes.Contents ?? []).filter(
      obj => obj.Key && obj.Key !== 'eval-dataset/' && !obj.Key.endsWith('/.keep')
    )

    const files = objects.map(obj => {
      const key = obj.Key!
      const parts = key.split('/')
      const folder = parts[1] ?? 'General'
      const rawFileName = parts[2] ?? key

      // 형식: {timestamp}_{evalType}_{filename}
      const evalTypeMatch = rawFileName.match(/^\d+_(End-to-End|Retrieval|Generation)_/)
      const evalType = evalTypeMatch ? evalTypeMatch[1] : 'Generation'
      const originalName = rawFileName.replace(/^\d+_(End-to-End|Retrieval|Generation)_/, '').replace(/^\d+_/, '')

      return {
        id: key,
        key,
        name: originalName,
        label: folder,
        folder,
        size: obj.Size ?? 0,
        uploadedAt: obj.LastModified?.toISOString() ?? '',
        rowCount: 0,
        evalType,
      }
    })

    // 폴더 목록도 반환 (.keep 파일 기반)
    const folderObjects = (listRes.Contents ?? []).filter(
      obj => obj.Key?.endsWith('/.keep')
    )
    const folders = folderObjects.map(obj => obj.Key!.split('/')[1]).filter(Boolean)

    return NextResponse.json({ files, folders })
  } catch (err) {
    console.error('List error:', err)
    return NextResponse.json({ error: '목록 조회 실패' }, { status: 500 })
  }
}