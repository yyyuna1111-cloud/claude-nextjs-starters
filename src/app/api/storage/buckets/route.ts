/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'

const FILER_URL = process.env.SEAWEEDFS_FILER_URL ?? 'http://10.70.171.177:31994'

// Go의 os.ModeDir 비트(1<<31)로 디렉토리 판별
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

export async function GET() {
  try {
    // /buckets/ 아래 디렉토리 = 각 PVC 버킷
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
        // 버킷 루트의 파일 목록으로 사용량 추정 (1단계 깊이)
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

    return NextResponse.json({ buckets })
  } catch (err: any) {
    console.error('[Storage Buckets]', err.message)
    return NextResponse.json({ buckets: [], error: err.message })
  }
}
