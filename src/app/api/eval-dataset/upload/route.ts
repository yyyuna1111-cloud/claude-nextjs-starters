import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const label = formData.get('label') as string ?? 'General'
    const folder = formData.get('folder') as string ?? label

    if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    // 엑셀 파싱 → 행수 + 평가유형 감지
    let rowCount = 0
    let evalType = 'G'
    let columns = ''
    try {
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)
      rowCount = rows.length
      columns = rows.length > 0 ? Object.keys(rows[0]).join(',') : ''
      const hasContext = columns.includes('ground_truth_context')
      const hasAnswer = columns.includes('answer')
      evalType = hasContext && hasAnswer ? 'End-to-End' : hasContext ? 'Retrieval' : 'Generation'
    } catch {
      // 파싱 실패 시 기본값 유지
    }

    const key = `eval-dataset/${folder}/${Date.now()}_${evalType}_${file.name}`

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
      Metadata: {
        label,
        folder,
        originalName: file.name,
        rowCount: String(rowCount),
        evalType,
        columns,
      },
    }))

    return NextResponse.json({ success: true, key, name: file.name, label, folder, rowCount, evalType })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: '업로드 실패' }, { status: 500 })
  }
}