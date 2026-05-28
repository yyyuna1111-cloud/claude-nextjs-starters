import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import * as XLSX from 'xlsx'

const MILVUS = process.env.MILVUS_ENDPOINT ?? 'http://localhost:19530'
const MILVUS_TOKEN = process.env.MILVUS_TOKEN ?? ''
const LLM_BASE_URL = process.env.LLM_BASE_URL ?? 'http://localhost:8000/v1'
const LLM_API_KEY = process.env.LLM_API_KEY ?? ''
const LLM_MODEL = process.env.LLM_MODEL ?? 'gpt-4o-mini'

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
    const {
      collection,
      textField = 'text',
      count = 20,
      label = 'General',
      folder,
    }: {
      collection: string
      textField: string
      count: number
      label: string
      folder: string
    } = await req.json()

    if (!collection) {
      return NextResponse.json({ error: 'collection 없음' }, { status: 400 })
    }

    const saveFolder = folder || label

    // 1. Milvus에서 청크 조회
    const milvusRes = await fetch(`${MILVUS}/v2/vectordb/entities/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(MILVUS_TOKEN ? { Authorization: `Bearer ${MILVUS_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        collectionName: collection,
        filter: '',
        outputFields: [textField, 'source'],
        limit: count,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!milvusRes.ok) {
      const errText = await milvusRes.text()
      throw new Error(`Milvus 조회 실패: ${errText}`)
    }

    const milvusData = await milvusRes.json()
    const entities: Record<string, string>[] = milvusData.data ?? []

    if (entities.length === 0) {
      return NextResponse.json({ error: 'Milvus에서 청크를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 2. LLM으로 QA 생성
    const qaRows: { question: string; answer: string; source: string }[] = []

    for (const entity of entities) {
      const chunkText = entity[textField] ?? ''
      const source = entity.source ?? ''
      if (!chunkText.trim()) continue

      try {
        const llmRes = await fetch(`${LLM_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LLM_API_KEY}`,
          },
          body: JSON.stringify({
            model: LLM_MODEL,
            messages: [
              {
                role: 'system',
                content:
                  '주어진 텍스트를 읽고 질문과 답변을 JSON 형식으로 생성하세요. 반드시 {"question": "...", "answer": "..."} 형식으로만 응답하세요.',
              },
              {
                role: 'user',
                content: `텍스트:\n${chunkText}`,
              },
            ],
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(30000),
        })

        const llmData = await llmRes.json()
        const content: string = llmData.choices?.[0]?.message?.content ?? ''
        const match = content.match(/\{[\s\S]*?\}/)
        if (!match) continue
        const parsed = JSON.parse(match[0]) as { question?: string; answer?: string }
        if (parsed.question && parsed.answer) {
          qaRows.push({ question: parsed.question, answer: parsed.answer, source })
        }
      } catch {
        // 개별 청크 실패 시 스킵
      }
    }

    if (qaRows.length === 0) {
      return NextResponse.json({ error: 'QA 생성에 실패했습니다. LLM 설정을 확인하세요.' }, { status: 500 })
    }

    // 3. xlsx 생성 → SeaweedFS 저장
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(qaRows)
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const fileName = `${collection}_qa_${Date.now()}.xlsx`
    const key = `eval-dataset/${saveFolder}/${Date.now()}_${fileName}`

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        Metadata: {
          label,
          folder: saveFolder,
          originalName: fileName,
          rowCount: String(qaRows.length),
          evalType: 'G',
          columns: 'question,answer,source',
        },
      })
    )

    return NextResponse.json({ success: true, key, name: fileName, rowCount: qaRows.length })
  } catch (err) {
    console.error('Generate error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}