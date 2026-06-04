/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

const K8S_API_URL = env.K8S_API_URL
const K8S_TOKEN = env.K8S_TOKEN

export async function GET() {
  try {
    if (env.K8S_SKIP_TLS_VERIFY === 'true') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    // InferenceService 리소스 조회 (serving.kserve.io/v1beta1)
    const isvcRes = await fetch(`${K8S_API_URL}/apis/serving.kserve.io/v1beta1/inferenceservices`, {
      headers: { Authorization: `Bearer ${K8S_TOKEN}` },
      next: { revalidate: 0 }
    })

    if (!isvcRes.ok) {
      throw new Error(`K8s API error: ${isvcRes.status}`)
    }

    const data = await isvcRes.json()
    const items = data.items || []

    const isvcs = items.map((item: any) => {
      // Ready 상태 확인 (status.conditions 내의 Ready 타입 찾기)
      const readyCondition = item.status?.conditions?.find((c: any) => c.type === 'Ready')
      const isReady = readyCondition?.status === 'True'
      
      // 실행 중인 노드 찾기 (보통 status.address.url이나 predictor의 status에서 유추 가능하나 
      // 정확한 노드는 해당 ISVC가 만든 Pod을 뒤져야 함. 여기선 우선 대표 URL 또는 Pending 표기)
      const url = item.status?.url || ''
      
      return {
        name: item.metadata.name,
        namespace: item.metadata.namespace,
        status: isReady ? 'Ready' : 'NotReady',
        url: url,
        createdAt: item.metadata.creationTimestamp,
        // 라벨 정보 (Argo 매핑용)
        labels: item.metadata.labels || {},
        // 구체적인 노드 정보는 Pod API와 병합 필요 (나중에 보완 가능)
        node: isReady ? 'Running' : 'Pending'
      }
    })

    return NextResponse.json({ isvcs })

  } catch (error: any) {
    console.error('[K8s ISVC API] Error:', error.message)
    return NextResponse.json({ isvcs: [], error: error.message }, { status: 500 })
  }
}
