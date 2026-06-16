/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const FILER_URL = process.env.SEAWEEDFS_FILER_URL ?? 'http://10.70.171.177:31994'
const NFS_SLLM_PATH = '/mnt/sllm'

function safePath(base: string, ...parts: string[]): string {
  const resolved = path.resolve(base, ...parts)
  if (!resolved.startsWith(path.resolve(base))) throw new Error('Invalid path')
  return resolved
}

async function filerListAll(bucket: string, prefix: string): Promise<string[]> {
  const url = `${FILER_URL}/buckets/${bucket}/${prefix}?limit=1000`
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
  if (!res.ok) return []
  const data = await res.json()
  const entries: any[] = data.Entries ?? []
  const keys: string[] = []
  for (const e of entries) {
    const mode: number = e.Mode ?? 0
    const isDir = (mode >>> 31) === 1
    const name = e.FullPath.split('/').filter(Boolean).pop() ?? ''
    const childPrefix = prefix ? `${prefix}${name}/` : `${name}/`
    if (isDir) {
      const children = await filerListAll(bucket, childPrefix)
      keys.push(...children)
    } else {
      keys.push(prefix ? `${prefix}${name}` : name)
    }
  }
  return keys
}

async function filerCopyFile(srcBucket: string, srcKey: string, destBucket: string, destKey: string) {
  const getRes = await fetch(`${FILER_URL}/buckets/${srcBucket}/${srcKey}`, { signal: AbortSignal.timeout(30000) })
  if (!getRes.ok) throw new Error(`소스 파일 읽기 실패: ${getRes.status}`)
  const body = await getRes.arrayBuffer()
  const contentType = getRes.headers.get('Content-Type') ?? 'application/octet-stream'
  const putRes = await fetch(`${FILER_URL}/buckets/${destBucket}/${destKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
    signal: AbortSignal.timeout(30000),
  })
  if (!putRes.ok) throw new Error(`대상 파일 쓰기 실패: ${putRes.status}`)
}

export async function POST(req: NextRequest) {
  try {
    const { sourceBucket, sourceKey, destBucket, destPrefix, name } = await req.json()

    if (!sourceBucket || !sourceKey || !destBucket || !name) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다' }, { status: 400 })
    }

    const isFolder = sourceKey.endsWith('/')
    const destKey = (destPrefix ?? '') + name

    if (sourceBucket === 'shared-sllm' || destBucket === 'shared-sllm') {
      const srcBase = sourceBucket === 'shared-sllm' ? NFS_SLLM_PATH : null
      const dstBase = destBucket === 'shared-sllm' ? NFS_SLLM_PATH : null

      if (srcBase && dstBase) {
        const srcPath = safePath(srcBase, sourceKey)
        const dstPath = safePath(dstBase, destKey)
        if (isFolder) {
          fs.cpSync(srcPath, dstPath, { recursive: true })
        } else {
          fs.mkdirSync(path.dirname(dstPath), { recursive: true })
          fs.copyFileSync(srcPath, dstPath)
        }
        return NextResponse.json({ success: true })
      }
      return NextResponse.json({ error: '버킷 간 복사는 같은 백엔드만 지원합니다' }, { status: 400 })
    }

    if (isFolder) {
      const strippedPrefix = sourceKey
      const allKeys = await filerListAll(sourceBucket, strippedPrefix)
      if (allKeys.length === 0) {
        const mkRes = await fetch(`${FILER_URL}/buckets/${destBucket}/${destKey}/`, {
          method: 'POST',
          headers: { 'Content-Length': '0' },
          signal: AbortSignal.timeout(10000),
        })
        if (!mkRes.ok && mkRes.status !== 404) {
          throw new Error(`빈 폴더 생성 실패: ${mkRes.status}`)
        }
      } else {
        for (const key of allKeys) {
          const relKey = key.startsWith(strippedPrefix) ? key.slice(strippedPrefix.length) : key
          const newDestKey = `${destKey}/${relKey}`
          await filerCopyFile(sourceBucket, key, destBucket, newDestKey)
        }
      }
    } else {
      await filerCopyFile(sourceBucket, sourceKey, destBucket, destKey)
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('[Storage Copy]', err)
    const message = err instanceof Error ? err.message : '복사 실패'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
