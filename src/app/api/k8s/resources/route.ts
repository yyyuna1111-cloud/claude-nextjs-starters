import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

const K8S_API_URL = env.K8S_API_URL
const K8S_TOKEN = env.K8S_TOKEN

const headers = {
  Authorization: `Bearer ${K8S_TOKEN}`,
  'Content-Type': 'application/json',
}

export async function GET() {
  try {
    if (!K8S_API_URL || !K8S_TOKEN) {
      throw new Error('Kubernetes API configuration is missing')
    }

    if (env.K8S_SKIP_TLS_VERIFY === 'true') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    // 타임아웃을 10초로 연장
    const timeout = 10000

    const [pvcRes, podsRes] = await Promise.all([
      fetch(`${K8S_API_URL}/api/v1/persistentvolumeclaims`, { 
        headers, 
        signal: AbortSignal.timeout(timeout), 
        next: { revalidate: 0 } 
      }),
      fetch(`${K8S_API_URL}/api/v1/pods`, { 
        headers, 
        signal: AbortSignal.timeout(timeout), 
        next: { revalidate: 0 } 
      }),
    ])

    if (!pvcRes.ok || !podsRes.ok) {
      const pvcErr = !pvcRes.ok ? `PVC: ${pvcRes.status}` : ''
      const podErr = !podsRes.ok ? `Pods: ${podsRes.status}` : ''
      throw new Error(`K8s API responded with error: ${pvcErr} ${podErr}`)
    }

    const [pvcData, podsData] = await Promise.all([
      pvcRes.json(),
      podsRes.json(),
    ])

    const pvcItems = pvcData?.items || []
    const podItems = podsData?.items || []

    // 1. 현재 사용 중인 PVC 이름 세트 생성
    const usedPvcNames = new Set<string>()
    podItems.forEach((pod: any) => {
      const ns = pod.metadata?.namespace || 'default'
      ;(pod.spec?.volumes || []).forEach((vol: any) => {
        if (vol.persistentVolumeClaim?.claimName) {
          usedPvcNames.add(`${ns}/${vol.persistentVolumeClaim.claimName}`)
        }
      })
    })

    // 2. PVC 데이터 처리 및 Orphaned 여부 판별
    let orphanedCount = 0
    let orphanedBytes = 0
    let totalReservedBytes = 0

    const pvcs = pvcItems.map((pvc: any) => {
      const name = pvc.metadata?.name || 'Unknown'
      const ns = pvc.metadata?.namespace || 'default'
      const capacityStr = pvc.status?.capacity?.storage || '0'
      const capacityBytes = parseStorageToBytes(capacityStr)
      const isUsed = usedPvcNames.has(`${ns}/${name}`)

      totalReservedBytes += capacityBytes
      if (!isUsed && pvc.status?.phase === 'Bound') {
        orphanedCount++
        orphanedBytes += capacityBytes
      }

      return {
        name,
        namespace: ns,
        capacity: capacityStr,
        isUsed,
        status: pvc.status?.phase || 'Unknown',
        yaml: JSON.stringify(pvc, null, 2),
      }
    })

    return NextResponse.json({
      pvcs,
      totalReservedTb: (totalReservedBytes / (1024 ** 4)).toFixed(1),
      orphanedCount,
      orphanedTb: (orphanedBytes / (1024 ** 4)).toFixed(2),
      pvcCount: pvcs.length,
    })

  } catch (error: any) {
    console.error('[K8s Storage API] Error:', error.message || error)
    
    // UI 응답 안정성을 위해 에러 시에도 기본 구조 반환
    return NextResponse.json({
      pvcs: [],
      totalReservedTb: '0.0',
      orphanedCount: 0,
      orphanedTb: '0.00',
      pvcCount: 0,
      error: error.message || 'Internal Server Error',
    })
  }
}

function parseStorageToBytes(storage: string): number {
  if (!storage || storage === '0') return 0
  const units: Record<string, number> = {
    'Ki': 1024, 'Mi': 1024 ** 2, 'Gi': 1024 ** 3, 'Ti': 1024 ** 4, 'Pi': 1024 ** 5,
    'K': 1000, 'M': 1000 ** 2, 'G': 1000 ** 3, 'T': 1000 ** 4,
  }
  const match = storage.match(/^(\d+)([a-zA-Z]*)$/)
  if (!match) return 0
  const value = parseInt(match[1])
  const unit = match[2]
  return value * (units[unit] || 1)
}
