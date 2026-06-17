import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { env } from '@/lib/env'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const username = req.nextUrl.searchParams.get('username')
  const action = req.nextUrl.searchParams.get('action') ?? 'off'

  if (!username) return NextResponse.json({ error: 'username 필요' }, { status: 400 })

  const serverName = name === 'default' ? '' : name

  const res = await fetch(`${env.JUPYTERHUB_URL}/hub/api/users/${username}/servers/${serverName}`, {
    method: 'DELETE',
    headers: { Authorization: `token ${env.JUPYTERHUB_TOKEN}` },
    signal: AbortSignal.timeout(10000),
  })

  if (res.status !== 204 && res.status !== 202) {
    return NextResponse.json({ error: `Hub API ${res.status}` }, { status: res.status })
  }

  if (action === 'delete') {
    const folderName = serverName || 'default'
    for (const root of ['/mnt/sllm', '/mnt/ds']) {
      const workDir = path.join(root, username, folderName)
      try {
        if (fs.existsSync(workDir)) {
          fs.rmSync(workDir, { recursive: true, force: true })
        }
      } catch { /* NFS 마운트 없는 환경 무시 */ }
    }
  }

  return NextResponse.json({ success: true })
}
