import { NextResponse } from 'next/server'

const RANCHER_URL = process.env.RANCHER_URL
const RANCHER_TOKEN = process.env.RANCHER_TOKEN
const CLUSTER_ID = process.env.RANCHER_CLUSTER_ID

const base = `${RANCHER_URL}/k8s/clusters/${CLUSTER_ID}`
const headers = {
  Authorization: `Bearer ${RANCHER_TOKEN ?? ''}`,
  'Content-Type': 'application/json',
}

export async function GET() {
  try {
    if (!RANCHER_URL || !CLUSTER_ID) {
      return NextResponse.json(getDummyData())
    }

    const [nodesRes, podsRes, isvcRes] = await Promise.all([
      fetch(`${base}/api/v1/nodes`, { headers, signal: AbortSignal.timeout(5000), next: { revalidate: 0 } }),
      fetch(`${base}/api/v1/pods`, { headers, signal: AbortSignal.timeout(5000), next: { revalidate: 0 } }),
      fetch(`${base}/apis/serving.kserve.io/v1beta1/inferenceservices`, { headers, signal: AbortSignal.timeout(5000), next: { revalidate: 0 } }),
    ])

    if (!nodesRes.ok || !podsRes.ok) {
      return NextResponse.json(getDummyData())
    }

    const [nodesData, podsData, isvcData] = await Promise.all([
      nodesRes.json(),
      podsRes.json(),
      isvcRes.ok ? isvcRes.json() : { items: [] },
    ])

    // 노드 처리
    const nodes = (nodesData.items || []).map((node: any) => {
      const labels = node.metadata?.labels || {}
      const status = node.status || {}
      const capacity = status.capacity || {}
      const allocatable = status.allocatable || {}
      const capacityKi = parseInt(capacity.memory?.replace('Ki', '') || '0')
      const allocatableKi = parseInt(allocatable.memory?.replace('Ki', '') || '0')
      const usedPercent = capacityKi > 0 ? Math.round(((capacityKi - allocatableKi) / capacityKi) * 100) : 0

      return {
        node: node.metadata?.name || 'Unknown',
        used: usedPercent,
        free: 100 - usedPercent,
        type: labels['node-role.kubernetes.io/control-plane'] !== undefined ? 'Master' : 'Worker',
        isGpu: labels['nvidia.com/gpu'] !== undefined,
      }
    })

    // ISVC 처리
    const isvcs = (isvcData.items || []).map((isvc: any) => {
      const meta = isvc.metadata || {}
      const status = isvc.status || {}
      const conditions = status.conditions || []
      const readyCond = conditions.find((c: any) => c.type === 'Ready')
      
      const relatedPod = (podsData.items || []).find((p: any) => 
        p.metadata?.namespace === meta.namespace && 
        p.metadata?.name?.includes(meta.name)
      )

      return {
        name: meta.name || 'Unknown',
        namespace: meta.namespace || 'default',
        status: readyCond?.status === 'True' ? 'Ready' : 'NotReady',
        node: relatedPod?.spec?.nodeName || 'Pending',
        createdAt: meta.creationTimestamp || new Date().toISOString(),
      }
    })

    // 네임스페이스 통계
    const nsStats: Record<string, any> = {}
    ;(podsData.items || []).forEach((pod: any) => {
      const ns = pod.metadata?.namespace || 'default'
      if (!nsStats[ns]) nsStats[ns] = { ns, running: 0, pending: 0, failed: 0, crash: 0, labels: [] }
      
      const phase = pod.status?.phase
      if (phase === 'Running') nsStats[ns].running++
      else if (phase === 'Pending') nsStats[ns].pending++
      else if (phase === 'Failed') nsStats[ns].failed++

      const appLabel = pod.metadata?.labels?.app
      if (appLabel && !nsStats[ns].labels.includes(appLabel)) nsStats[ns].labels.push(appLabel)
    })

    return NextResponse.json({
      nodes,
      isvcs,
      namespaces: Object.values(nsStats).map((n: any) => ({ ...n, labels: n.labels.slice(0, 2) })),
      totalPods: podsData.items.length,
      unhealthyPods: 0,
    })
  } catch (error) {
    console.error('[Rancher] API Error:', error)
    return NextResponse.json(getDummyData())
  }
}

function getDummyData() {
  return {
    nodes: [
      { node: 'gpu-node-01', used: 85, free: 15, type: 'Worker', isGpu: true },
      { node: 'cpu-node-01', used: 40, free: 60, type: 'Worker', isGpu: false },
    ],
    namespaces: [
      { ns: 'mlops', running: 10, pending: 1, failed: 0, crash: 0, labels: ['train'] },
      { ns: 'serving', running: 5, pending: 0, failed: 0, crash: 0, labels: ['api'] },
    ],
    isvcs: [
      {
        name: 'bert-base-korean-v1',
        namespace: 'embedding',
        status: 'Ready',
        node: 'gpu-node-01',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        name: 'roberta-small-en',
        namespace: 'embedding',
        status: 'NotReady',
        node: 'Pending',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      }
    ],
    totalPods: 15,
    unhealthyPods: 0,
  }
}
