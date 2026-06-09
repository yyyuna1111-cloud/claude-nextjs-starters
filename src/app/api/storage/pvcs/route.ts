/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

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

export async function GET() {
  try {
    if (env.K8S_SKIP_TLS_VERIFY === 'true') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    const headers = {
      Authorization: `Bearer ${env.K8S_TOKEN}`,
      'Content-Type': 'application/json',
    }
    const opts = { headers, signal: AbortSignal.timeout(10000), next: { revalidate: 0 } }

    // PVC 목록 + PV 목록 동시 조회
    const [pvcRes, pvRes] = await Promise.all([
      fetch(`${env.K8S_API_URL}/api/v1/namespaces/datascience-storage/persistentvolumeclaims`, opts),
      fetch(`${env.K8S_API_URL}/api/v1/persistentvolumes`, opts),
    ])

    if (!pvcRes.ok) throw new Error(`K8s PVC API ${pvcRes.status}`)

    const pvcData = await pvcRes.json()

    // PV 목록으로 pvcName → pvName(= Filer 버킷명) 맵 구성
    const pvcToBucket: Record<string, string> = {}
    if (pvRes.ok) {
      const pvData = await pvRes.json()
      for (const pv of pvData.items ?? []) {
        const claimRef = pv.spec?.claimRef
        if (claimRef?.namespace === 'datascience-storage' && claimRef?.name) {
          pvcToBucket[claimRef.name] = pv.metadata?.name ?? ''
        }
      }
    }

    const pvcs = (pvcData.items ?? []).map((pvc: any) => {
      const name: string = pvc.metadata?.name ?? 'unknown'
      const capacityStr: string =
        pvc.status?.capacity?.storage ?? pvc.spec?.resources?.requests?.storage ?? '0'
      const storageClass: string = pvc.spec?.storageClassName ?? ''
      // static PV(storageClass 없음)는 PVC 이름을 버킷 식별자로 사용
      const volumeName: string = storageClass === ''
        ? name
        : (pvc.spec?.volumeName || pvcToBucket[name] || '')

      return {
        name,
        namespace: 'datascience-storage',
        capacity: capacityStr,
        capacityBytes: parseStorageToBytes(capacityStr),
        status: pvc.status?.phase ?? 'Unknown',
        storageClass: pvc.spec?.storageClassName ?? '',
        createdAt: pvc.metadata?.creationTimestamp ?? '',
        type: name.startsWith('shared-') ? 'shared' : 'personal',
        volumeName,
        user: name.startsWith('personal-') ? name.replace('personal-', '') : null,
      }
    })

    return NextResponse.json({ pvcs })
  } catch (err: any) {
    console.error('[Storage PVCs]', err.message)
    return NextResponse.json({ pvcs: [], error: err.message })
  }
}
