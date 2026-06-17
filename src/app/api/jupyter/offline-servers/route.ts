import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { env } from '@/lib/env'

const NFS_ROOTS: Record<string, string> = {
  'shared-sllm': '/mnt/sllm',
  'ds-nfs': '/mnt/ds',
}

function hubHeaders() {
  return { Authorization: `token ${env.JUPYTERHUB_TOKEN}` }
}

function scanUserDirs(nfsType: string, username: string): string[] {
  const userDir = path.join(NFS_ROOTS[nfsType], username)
  try {
    if (!fs.existsSync(userDir)) return []
    return fs.readdirSync(userDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')
  if (!username) return NextResponse.json({ error: 'username 필요' }, { status: 400 })

  // 현재 실행 중인 서버 이름 목록 조회
  let runningNames = new Set<string>()
  try {
    const res = await fetch(`${env.JUPYTERHUB_URL}/hub/api/users/${username}`, {
      headers: hubHeaders(),
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const data = await res.json()
      runningNames = new Set(
        Object.keys(data.servers ?? {}).map(n => n || 'default')
      )
    }
  } catch { /* Hub 미응답 시 running 없다고 간주 */ }

  // NFS 폴더 스캔 후 실행 중이 아닌 폴더를 오프라인 서버로 반환
  const offline: Array<{ name: string; nfsType: string }> = []
  for (const [nfsType, _root] of Object.entries(NFS_ROOTS)) {
    const dirs = scanUserDirs(nfsType, username)
    for (const dir of dirs) {
      if (!runningNames.has(dir)) {
        // 중복 방지: 같은 이름이 두 NFS 모두에 있으면 둘 다 표시
        offline.push({ name: dir, nfsType })
      }
    }
  }

  return NextResponse.json({ servers: offline })
}

export async function DELETE(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')
  const name = req.nextUrl.searchParams.get('name')
  const nfsType = req.nextUrl.searchParams.get('nfs_type')

  if (!username || !name) return NextResponse.json({ error: 'username, name 필요' }, { status: 400 })

  const roots = nfsType && NFS_ROOTS[nfsType] ? [NFS_ROOTS[nfsType]] : Object.values(NFS_ROOTS)

  for (const root of roots) {
    const workDir = path.join(root, username, name)
    try {
      if (fs.existsSync(workDir)) {
        fs.rmSync(workDir, { recursive: true, force: true })
      }
    } catch { /* NFS 마운트 없는 환경 무시 */ }
  }

  return NextResponse.json({ success: true })
}
