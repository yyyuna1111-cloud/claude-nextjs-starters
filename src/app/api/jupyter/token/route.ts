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

  let res = await fetch(`${env.JUPYTERHUB_URL}/hub/api/users/${username}/tokens`, {
    method: 'POST',
    headers: hubHeaders(),
    body: JSON.stringify({ expires_in: 300, scopes: [`access:servers!user=${username}`] }),
    signal: AbortSignal.timeout(5000),
  })

  // 만약 유저가 없어서 404 에러가 나면 유저를 먼저 생성하고 다시 토큰을 요청
  if (res.status === 404) {
    const createRes = await fetch(`${env.JUPYTERHUB_URL}/hub/api/users/${username}`, {
      method: 'POST',
      headers: hubHeaders(),
      signal: AbortSignal.timeout(5000),
    })
    
    if (!createRes.ok) {
      return NextResponse.json({ error: `Hub API Create User Failed: ${createRes.status}` }, { status: createRes.status })
    }

    // 유저 생성 후 토큰 재요청
    res = await fetch(`${env.JUPYTERHUB_URL}/hub/api/users/${username}/tokens`, {
      method: 'POST',
      headers: hubHeaders(),
      body: JSON.stringify({ expires_in: 300, scopes: [`access:servers!user=${username}`] }),
      signal: AbortSignal.timeout(5000),
    })
  }

  if (!res.ok) return NextResponse.json({ error: `Hub API ${res.status}` }, { status: res.status })
  const data = await res.json()
  return NextResponse.json({ token: data.token })
}
