import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

function hubHeaders() {
  return {
    Authorization: `token ${env.JUPYTERHUB_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export async function POST(req: NextRequest) {
  const { username } = await req.json()
  if (!username) return NextResponse.json({ error: 'username 필요' }, { status: 400 })

  const res = await fetch(`${env.JUPYTERHUB_URL}/hub/api/users/${username}/tokens`, {
    method: 'POST',
    headers: hubHeaders(),
    body: JSON.stringify({ expires_in: 300, scopes: [`access:servers!user=${username}`] }),
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) return NextResponse.json({ error: `Hub API ${res.status}` }, { status: res.status })
  const data = await res.json()
  return NextResponse.json({ token: data.token })
}
