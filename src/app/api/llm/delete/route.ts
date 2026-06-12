/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

const K8S_API_URL = env.K8S_API_URL
const K8S_TOKEN = env.K8S_TOKEN

const authHeaders = {
  Authorization: `Bearer ${K8S_TOKEN}`,
  'Content-Type': 'application/json',
}

export async function DELETE(req: NextRequest) {
  try {
    if (env.K8S_SKIP_TLS_VERIFY === 'true') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    const { name, namespace } = await req.json()
    if (!name || !namespace) {
      return NextResponse.json({ error: 'name, namespace 필수' }, { status: 400 })
    }

    const res = await fetch(`${K8S_API_URL}/apis/serving.kserve.io/v1beta1/namespaces/${namespace}/inferenceservices/${name}`, {
      method: 'DELETE',
      headers: authHeaders,
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const msg = (await res.json())?.message ?? res.status
      return NextResponse.json({ error: `InferenceService 삭제 실패: ${msg}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[LLM Delete API]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
