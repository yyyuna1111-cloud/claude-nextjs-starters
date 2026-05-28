import { NextResponse } from 'next/server'

const MILVUS = process.env.MILVUS_ENDPOINT ?? 'http://localhost:19530'
const TOKEN = process.env.MILVUS_TOKEN ?? ''

export async function GET() {
  try {
    const res = await fetch(`${MILVUS}/v2/vectordb/collections/list`, {
      headers: {
        'Content-Type': 'application/json',
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const collections: string[] = data.data ?? []
    return NextResponse.json({ collections })
  } catch (err) {
    console.error('Milvus collections error:', err)
    return NextResponse.json({ error: 'Milvus 연결 실패. MILVUS_ENDPOINT를 확인하세요.' }, { status: 500 })
  }
}