import { NextResponse } from 'next/server'
import fs from 'fs'

const NFS_MOUNTS: Record<string, string> = {
  'shared-sllm': '/mnt/sllm',
  'ds-nfs': '/mnt/ds',
}

function getNfsBucketInfo(name: string, mountPath: string) {
  try {
    const entries = fs.readdirSync(mountPath, { withFileTypes: true })
    let totalSize = 0
    let fileCount = 0
    for (const e of entries) {
      if (e.isFile()) {
        const stat = fs.statSync(`${mountPath}/${e.name}`)
        totalSize += stat.size
        fileCount++
      }
    }
    return { name, createdAt: '', totalSize, fileCount }
  } catch {
    return { name, createdAt: '', totalSize: 0, fileCount: 0 }
  }
}

export async function GET() {
  const buckets = Object.entries(NFS_MOUNTS).map(([name, mountPath]) =>
    getNfsBucketInfo(name, mountPath)
  )
  return NextResponse.json({ buckets })
}
