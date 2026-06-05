import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth'
import { env } from '@/lib/env'

export async function POST(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ ok: true })

  const username = await verifySessionToken(token)
  if (!username) return NextResponse.json({ ok: true })

  // JupyterHub 유저 토큰 전체 삭제
  await fetch(`${env.JUPYTERHUB_URL}/hub/api/users/${username}/tokens`, {
    headers: { Authorization: `token ${env.JUPYTERHUB_TOKEN}` },
    signal: AbortSignal.timeout(5000),
  })
    .then(async r => {
      if (!r.ok) return
      const data = await r.json()
      for (const t of data ?? []) {
        await fetch(`${env.JUPYTERHUB_URL}/hub/api/users/${username}/tokens/${t.id}`, {
          method: 'DELETE',
          headers: { Authorization: `token ${env.JUPYTERHUB_TOKEN}` },
        }).catch(() => {})
      }
    })
    .catch(() => {})

  return NextResponse.json({ ok: true })
}
