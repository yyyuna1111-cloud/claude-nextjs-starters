/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth'
import { env } from '@/lib/env'

const NFS_SLLM_PATH = '/mnt/sllm'

function parseStorageToBytes(storage: string): number {
  if (!storage || storage === '0') return 0
  const units: Record<string, number> = {
    Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4,
    K: 1000, M: 1000 ** 2, G: 1000 ** 3, T: 1000 ** 4,
  }
  const m = storage.match(/^(\d+)([a-zA-Z]*)$/)
  if (!m) return 0
  return parseInt(m[1]) * (units[m[2]] || 1)
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  let username: string | null = null
  if (token) {
    username = await verifySessionToken(token)
  }

  try {
    if (env.K8S_SKIP_TLS_VERIFY === 'true') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    const headers = {
      Authorization: `Bearer ${env.K8S_TOKEN}`,
      'Content-Type': 'application/json',
    }
    const opts = { headers, signal: AbortSignal.timeout(10000), next: { revalidate: 0 } }

    // dshub 네임스페이스에서 NFS static PVC 조회 (storageClassName: "")
    const pvcRes = await fetch(`${env.K8S_API_URL}/api/v1/namespaces/dshub/persistentvolumeclaims`, opts)
    if (!pvcRes.ok) throw new Error(`K8s PVC API ${pvcRes.status}`)

    const pvcData = await pvcRes.json()

    const pvcs = (pvcData.items ?? [])
      .filter((pvc: any) => pvc.spec?.storageClassName === '')
      .map((pvc: any) => {
        const name: string = pvc.metadata?.name ?? 'unknown'
        const capacityStr: string =
          pvc.status?.capacity?.storage ?? pvc.spec?.resources?.requests?.storage ?? '0'
        return {
          name,
          namespace: 'dshub',
          capacity: capacityStr,
          capacityBytes: parseStorageToBytes(capacityStr),
          status: pvc.status?.phase ?? 'Unknown',
          storageClass: '',
          createdAt: pvc.metadata?.creationTimestamp ?? '',
          type: 'shared' as const,
          volumeName: name,
          user: null,
        }
      })

    // 개인 버킷: shared-sllm/{username}/ 폴더
    if (username) {
      const userFolder = path.join(NFS_SLLM_PATH, username)
      try {
        if (!fs.existsSync(userFolder)) {
          fs.mkdirSync(userFolder, { recursive: true })
        }
      } catch { /* NFS 미마운트 시 무시 */ }

      pvcs.push({
        name: username,
        namespace: 'dshub',
        capacity: '',
        capacityBytes: 0,
        status: 'Bound',
        storageClass: '',
        createdAt: '',
        type: 'personal' as const,
        volumeName: username,
        user: username,
      })
    }

    return NextResponse.json({ pvcs })
  } catch (err: any) {
    console.error('[Storage PVCs]', err.message)
    return NextResponse.json({ pvcs: [], error: err.message })
  }
}
