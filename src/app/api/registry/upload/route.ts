import { NextRequest, NextResponse } from 'next/server'
import { createWriteStream } from 'fs'
import { unlink } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { spawn } from 'child_process'
import { randomUUID } from 'crypto'

export const maxDuration = 300

const REGISTRY_URL = process.env.DOCKER_REGISTRY_URL ?? 'http://10.70.170.227'
const REGISTRY_HOST = REGISTRY_URL.replace(/^https?:\/\//, '')

function runSkopeo(src: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('skopeo', [
      'copy', '--insecure-policy',
      `docker-archive:${src}`,
      `docker://${dest}`,
      '--dest-tls-verify=false',
    ])
    let errOutput = ''
    proc.stderr.on('data', (d: Buffer) => { errOutput += d.toString() })
    proc.on('close', (code: number) => {
      if (code === 0) resolve()
      else reject(new Error(errOutput || `skopeo exited with code ${code}`))
    })
    proc.on('error', (err: NodeJS.ErrnoException) => {
      reject(new Error(err.code === 'ENOENT' ? 'skopeo가 설치되지 않았습니다' : err.message))
    })
  })
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const name = (formData.get('name') as string | null)?.trim()
  const tag = (formData.get('tag') as string | null)?.trim() || 'latest'

  if (!file || !name) {
    return NextResponse.json({ error: 'file과 name이 필요합니다' }, { status: 400 })
  }

  const tmpPath = `/tmp/registry-upload-${randomUUID()}.tar`
  try {
    const readable = Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0])
    await pipeline(readable, createWriteStream(tmpPath))
    await runSkopeo(tmpPath, `${REGISTRY_HOST}/${name}:${tag}`)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '업로드 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    unlink(tmpPath).catch(() => {})
  }
}
