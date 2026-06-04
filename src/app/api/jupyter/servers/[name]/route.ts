import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const username = req.nextUrl.searchParams.get('username')
  if (!username) return NextResponse.json({ error: 'username 필요' }, { status: 400 })

  const serverName = name === 'default' ? '' : name
  const res = await fetch(`${env.JUPYTERHUB_URL}/hub/api/users/${username}/servers/${serverName}`, {
    method: 'DELETE',
    headers: {
      Authorization: `token ${env.JUPYTERHUB_TOKEN}`,
    },
    signal: AbortSignal.timeout(10000),
  })

  if (res.status === 204 || res.status === 202) return NextResponse.json({ success: true })
  return NextResponse.json({ error: `Hub API ${res.status}` }, { status: res.status })
}
