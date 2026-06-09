/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import fs from 'fs'

const FILER_URL = process.env.SEAWEEDFS_FILER_URL ?? 'http://10.70.171.177:31994'
const NFS_SLLM_PATH = '/mnt/sllm'

function isDir(mode: number): boolean {
  return (mode >>> 31) === 1
}

interface FilerEntry {
  FullPath: string
  Mtime: string
  Mode: number
  FileSize: number
  chunks: any[] | null
}

async function listDir(path: string): Promise<FilerEntry[]> {
  const url = `${FILER_URL}${path}?limit=1000`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
    next: { revalidate: 0 },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.Entries ?? []
}

function getNfsBucketInfo() {
  try {
    const entries = fs.readdirSync(NFS_SLLM_PATH, { withFileTypes: true })
    let totalSize = 0
    let fileCount = 0
    for (const e of entries) {
      if (e.isFile()) {
        const stat = fs.statSync(`${NFS_SLLM_PATH}/${e.name}`)
        totalSize += stat.size
        fileCount++
      }
    }
    return { name: 'shared-sllm', createdAt: '', totalSize, fileCount, isNfs: true }
  } catch {
    return { name: 'shared-sllm', createdAt: '', totalSize: 0, fileCount: 0, isNfs: true }
  }
}

export async function GET() {
  try {
    const entries = await listDir('/buckets/')
    const bucketEntries = entries.filter(
      e => isDir(e.Mode) && (
        e.FullPath.includes('pvc-') ||
        e.FullPath.includes('personal-') ||
        e.FullPath.includes('shared-')
      )
    )

    const buckets = await Promise.all(
      bucketEntries.map(async e => {
        const name = e.FullPath.split('/').filter(Boolean).pop() ?? ''
        let totalSize = 0
        let fileCount = 0
        try {
          const children = await listDir(`/buckets/${name}/`)
          for (const child of children) {
            if (!isDir(child.Mode)) {
              totalSize += child.FileSize ?? 0
              fileCount++
            }
          }
        } catch {
          // 빈 버킷
        }
        return { name, createdAt: e.Mtime, totalSize, fileCount }
      })
    )

    return NextResponse.json({ buckets: [...buckets, getNfsBucketInfo()] })
  } catch (err: any) {
    console.error('[Storage Buckets]', err.message)
    return NextResponse.json({ buckets: [getNfsBucketInfo()], error: err.message })
  }
}
