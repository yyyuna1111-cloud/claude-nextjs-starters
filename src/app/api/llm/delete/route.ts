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

    const [depRes, svcRes] = await Promise.allSettled([
      fetch(`${K8S_API_URL}/apis/apps/v1/namespaces/${namespace}/deployments/${name}`, {
        method: 'DELETE',
        headers: authHeaders,
        next: { revalidate: 0 },
      }),
      fetch(`${K8S_API_URL}/api/v1/namespaces/${namespace}/services/${name}`, {
        method: 'DELETE',
        headers: authHeaders,
        next: { revalidate: 0 },
      }),
    ])

    const depOk = depRes.status === 'fulfilled' && depRes.value.ok
    const svcOk = svcRes.status === 'fulfilled' && svcRes.value.ok

    if (!depOk) {
      const msg = depRes.status === 'fulfilled'
        ? (await depRes.value.json())?.message ?? depRes.value.status
        : (depRes.reason as Error).message
      return NextResponse.json({ error: `Deployment 삭제 실패: ${msg}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, serviceDeleted: svcOk })
  } catch (error: any) {
    console.error('[LLM Delete API]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
