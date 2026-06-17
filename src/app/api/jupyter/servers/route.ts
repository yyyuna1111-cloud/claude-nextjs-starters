/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { env } from '@/lib/env'

function hubHeaders() {
  return {
    Authorization: `token ${env.JUPYTERHUB_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')
  if (!username) return NextResponse.json({ error: 'username 필요' }, { status: 400 })

  const res = await fetch(`${env.JUPYTERHUB_URL}/hub/api/users/${username}`, {
    headers: hubHeaders(),
    signal: AbortSignal.timeout(10000),
  })
  if (res.status === 404) return NextResponse.json({ servers: [] })
  if (!res.ok) return NextResponse.json({ error: `Hub API ${res.status}` }, { status: res.status })

  const data = await res.json()

  // 유저 토큰 발급 (URL에 포함해서 별도 로그인 불필요)
  let token = ''
  const tokenRes = await fetch(`${env.JUPYTERHUB_URL}/hub/api/users/${username}/tokens`, {
    method: 'POST',
    headers: hubHeaders(),
    body: JSON.stringify({ expires_in: 86400, scopes: [`access:servers!user=${username}`] }),
    signal: AbortSignal.timeout(10000),
  })
  if (tokenRes.ok) {
    const tokenData = await tokenRes.json()
    token = tokenData.token ?? ''
  }

  const publicUrl = process.env.NEXT_PUBLIC_JUPYTERHUB_URL ?? env.JUPYTERHUB_URL
  const servers = Object.entries(data.servers ?? {}).map(([name, s]: [string, any]) => ({
    name: name || 'default',
    ready: s.ready ?? false,
    pending: s.pending ?? null,
    url: `${publicUrl}/user/${username}/${name || ''}/lab`,
  }))

  const hubLoginUrl = token ? `${env.JUPYTERHUB_URL}/hub/home?token=${token}` : null

  return NextResponse.json({ servers, hubLoginUrl })
}

export async function POST(req: NextRequest) {
  const { username, name, image, gpu_type } = await req.json()
  if (!username || !name) return NextResponse.json({ error: 'username, name 필요' }, { status: 400 })

  // shared-sllm NFS에 유저/서버 폴더 생성 (subPath 마운트 전에 존재해야 함)
  const workDir = path.join('/mnt/sllm', username, name)
  try {
    fs.mkdirSync(workDir, { recursive: true })
  } catch {
    // 대시보드 pod에 /mnt/sllm이 없는 환경(로컬 개발)에서는 무시
  }

  // 유저 없으면 먼저 생성
  const userCheck = await fetch(`${env.JUPYTERHUB_URL}/hub/api/users/${username}`, {
    headers: hubHeaders(),
    signal: AbortSignal.timeout(10000),
  })
  if (userCheck.status === 404) {
    await fetch(`${env.JUPYTERHUB_URL}/hub/api/users/${username}`, {
      method: 'POST',
      headers: hubHeaders(),
      signal: AbortSignal.timeout(10000),
    })
  }

  // JupyterHub API는 POST body 전체를 spawner.user_options로 저장
  const body: any = {}
  if (image) body.image = image
  if (gpu_type === 'standard' || gpu_type === 'high') body.gpu_type = gpu_type

  const res = await fetch(`${env.JUPYTERHUB_URL}/hub/api/users/${username}/servers/${name}`, {
    method: 'POST',
    headers: hubHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })

  if (res.status === 201 || res.status === 202) return NextResponse.json({ success: true })
  return NextResponse.json({ error: `Hub API ${res.status}` }, { status: res.status })
}
