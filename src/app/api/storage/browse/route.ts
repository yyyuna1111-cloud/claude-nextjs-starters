/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const NFS_ROOTS: Record<string, string> = {
  'shared-sllm': '/mnt/sllm',
  'ds-nfs': '/mnt/ds',
}

function safePath(base: string, ...parts: string[]): string {
  const resolved = path.resolve(base, ...parts)
  if (!resolved.startsWith(path.resolve(base))) throw new Error('Invalid path')
  return resolved
}

function getNfsBase(bucket: string): string | null {
  if (bucket in NFS_ROOTS) return NFS_ROOTS[bucket]
  if (!bucket.startsWith('shared-')) return '/mnt/sllm'  // personal bucket
  return null
}

function resolveNfsPath(bucket: string, ...parts: string[]): string {
  const base = getNfsBase(bucket)!
  if (bucket in NFS_ROOTS) return safePath(base, ...parts)
  return safePath(base, bucket, ...parts)  // personal: /mnt/sllm/{username}/{...}
}

function isDir(mode: number): boolean {
  return (mode >>> 31) === 1
}

export async function GET(req: NextRequest) {
  const bucket = req.nextUrl.searchParams.get('bucket')
  const prefix = req.nextUrl.searchParams.get('prefix') ?? ''

  if (!bucket) return NextResponse.json({ error: 'bucket 파라미터가 필요합니다' }, { status: 400 })

  if (getNfsBase(bucket) !== null) {
    try {
      const dirPath = resolveNfsPath(bucket, prefix)
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })

      const folders = entries
        .filter(e => e.isDirectory())
        .map(e => ({ name: e.name, prefix: prefix ? `${prefix}${e.name}/` : `${e.name}/` }))

      const files = entries
        .filter(e => e.isFile())
        .map(e => {
          const stat = fs.statSync(path.join(dirPath, e.name))
          return {
            key: prefix ? `${prefix}${e.name}` : e.name,
            name: e.name,
            size: stat.size,
            lastModified: stat.mtime.toISOString(),
          }
        })

      return NextResponse.json({ folders, files, prefix, bucket, isTruncated: false })
    } catch (err: any) {
      console.error('[Storage Browse NFS]', err.message)
      return NextResponse.json({ folders: [], files: [], error: err.message })
    }
  }

  // SeaweedFS fallback (레거시, 현재 미사용)
  const FILER_URL = process.env.SEAWEEDFS_FILER_URL ?? 'http://10.70.171.177:31994'
  const dirPath = `/buckets/${bucket}/${prefix}`
  const url = `${FILER_URL}${dirPath}?limit=500`

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return NextResponse.json({ folders: [], files: [], prefix, bucket, error: `Filer ${res.status}` })
    }

    const data = await res.json()
    const filerEntries: any[] = data.Entries ?? []

    const folders = filerEntries
      .filter(e => isDir(e.Mode))
      .map(e => {
        const name = e.FullPath.split('/').filter(Boolean).pop() ?? ''
        return { name, prefix: prefix ? `${prefix}${name}/` : `${name}/` }
      })

    const files = filerEntries
      .filter(e => !isDir(e.Mode))
      .map(e => ({
        key: prefix ? `${prefix}${e.FullPath.split('/').pop()}` : (e.FullPath.split('/').pop() ?? ''),
        name: e.FullPath.split('/').pop() ?? '',
        size: e.FileSize ?? 0,
        lastModified: e.Mtime ?? '',
      }))

    return NextResponse.json({ folders, files, prefix, bucket, isTruncated: data.ShouldDisplayLoadMore })
  } catch (err: any) {
    console.error('[Storage Browse]', err.message)
    return NextResponse.json({ folders: [], files: [], error: err.message })
  }
}
