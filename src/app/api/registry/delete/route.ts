/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'

const REGISTRY = process.env.DOCKER_REGISTRY_URL ?? 'http://10.70.170.227'

export async function DELETE(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')
  const digest = req.nextUrl.searchParams.get('digest')
  if (!name || !digest) return NextResponse.json({ error: 'name, digest 파라미터 필요' }, { status: 400 })

  try {
    // Registry에서 삭제하려면 digest 기반으로 manifest를 DELETE
    const res = await fetch(`${REGISTRY}/v2/${name}/manifests/${digest}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(10000),
    })

    // 202 Accepted or 404
    if (!res.ok && res.status !== 404) {
      throw new Error(`Registry ${res.status}`)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Registry Delete]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
