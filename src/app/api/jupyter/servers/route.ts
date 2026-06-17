/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { env } from '@/lib/env'

const NFS_ROOTS: Record<string, string> = {
  'shared-sllm': '/mnt/sllm',
  'ds-nfs': '/mnt/ds',
}

function hubHeaders() {
  return {
    Authorization: `token ${env.JUPYTERHUB_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

function ensureWorkDir(nfsType: string, username: string, servername: string) {
  const root = NFS_ROOTS[nfsType] ?? NFS_ROOTS['shared-sllm']
  const userDir = path.join(root, username)
  const workDir = path.join(userDir, servername)
  try {
    fs.mkdirSync(workDir, { recursive: true })
    // NFS root_squash 환경에서 root→nobody로 squash됨.
    // nobody가 생성한 dir은 nobody 소유이므로 chmod는 가능, jovyan(1000)이 쓸 수 있게 777 설정.
    fs.chmodSync(userDir, 0o777)
    fs.chmodSync(workDir, 0o777)
  } catch {
    // 로컬 개발환경처럼 /mnt/sllm|ds 가 없으면 무시
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
  const { username, name, image, gpu_type, nfs_type } = await req.json()
  if (!username || !name) return NextResponse.json({ error: 'username, name 필요' }, { status: 400 })

  const selectedNfs = nfs_type === 'ds-nfs' ? 'ds-nfs' : 'shared-sllm'

  // NFS 작업 디렉터리 생성 (subPath 마운트 전에 존재해야 함) + chmod 777
  ensureWorkDir(selectedNfs, username, name)

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
  const body: any = { nfs_type: selectedNfs }
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
