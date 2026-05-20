import { NextResponse } from 'next/server'
import https from 'https'

// Rancher 자체 서명 인증서 무시
const agent = new https.Agent({ rejectUnauthorized: false })

const RANCHER_URL = process.env.RANCHER_URL // https://localhost:31957
const RANCHER_TOKEN = process.env.RANCHER_TOKEN
const CLUSTER_ID = process.env.RANCHER_CLUSTER_ID // c-mkhtt

const base = `${RANCHER_URL}/k8s/clusters/${CLUSTER_ID}`
const headers = {
  Authorization: `Bearer ${RANCHER_TOKEN ?? ''}`,
  'Content-Type': 'application/json',
}

export async function GET() {
  try {
    if (!RANCHER_URL || !CLUSTER_ID)
      throw new Error('Rancher env not configured')

    const [nodesRes, podsRes] = await Promise.all([
      fetch(`${base}/api/v1/nodes`, {
        headers,
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
        ...({ agent } as object),
      }),
      fetch(`${base}/api/v1/pods`, {
        headers,
        signal: AbortSignal.timeout(5000),
        cache: 'no-store',
        ...({ agent } as object),
      }),
    ])

    if (!nodesRes.ok) throw new Error(`nodes: ${nodesRes.status}`)
    if (!podsRes.ok) throw new Error(`pods: ${podsRes.status}`)

    const [nodesData, podsData] = await Promise.all([
      nodesRes.json(),
      podsRes.json(),
    ])

    // 노드별 메모리 사용량 (metrics API)
    const metricsMap: Record<string, number> = {}
    try {
      const metricsRes = await fetch(
        `${base}/apis/metrics.k8s.io/v1beta1/nodes`,
        {
          headers,
          signal: AbortSignal.timeout(3000),
          cache: 'no-store',
          ...({ agent } as object),
        }
      )
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json()
        metricsData.items?.forEach((m: Record<string, unknown>) => {
          const name = (m.metadata as Record<string, string>).name
          const usageKi = parseInt(
            (m.usage as Record<string, string>).memory.replace('Ki', '')
          )
          metricsMap[name] = usageKi
        })
      }
    } catch {}

    const nodes = nodesData.items.map((node: Record<string, unknown>) => {
      const meta = node.metadata as Record<string, unknown>
      const status = node.status as Record<string, unknown>
      const capacity = status.capacity as Record<string, string>
      const allocatable = status.allocatable as Record<string, string>
      const labels = meta.labels as Record<string, string>

      const capacityKi = parseInt(capacity.memory.replace('Ki', ''))
      const allocatableKi = parseInt(allocatable.memory.replace('Ki', ''))
      const usedKi =
        metricsMap[meta.name as string] ?? capacityKi - allocatableKi
      const usedPercent = Math.round((usedKi / capacityKi) * 100)

      return {
        node: meta.name,
        used: usedPercent,
        free: 100 - usedPercent,
        type:
          labels['node-role.kubernetes.io/control-plane'] !== undefined
            ? 'Master'
            : 'Worker',
        isGpu: labels['nvidia.com/gpu'] !== undefined,
      }
    })

    // 네임스페이스별 Pod 상태 집계
    const nsStats: Record<string, Record<string, unknown>> = {}
    podsData.items.forEach((pod: Record<string, unknown>) => {
      const meta = pod.metadata as Record<string, unknown>
      const podStatus = pod.status as Record<string, unknown>
      const ns = meta.namespace as string
      const phase = podStatus.phase as string
      const containerStatuses =
        (podStatus.containerStatuses as
          | Record<string, unknown>[]
          | undefined) ?? []
      const isCrash = containerStatuses.some(
        c =>
          (c.state as Record<string, unknown>)?.waiting &&
          (c.state as Record<string, Record<string, string>>).waiting
            ?.reason === 'CrashLoopBackOff'
      )

      if (!nsStats[ns])
        nsStats[ns] = {
          ns,
          running: 0,
          pending: 0,
          failed: 0,
          crash: 0,
          labels: [],
        }

      if (isCrash) (nsStats[ns].crash as number)++
      else if (phase === 'Running') (nsStats[ns].running as number)++
      else if (phase === 'Pending') (nsStats[ns].pending as number)++
      else if (phase === 'Failed') (nsStats[ns].failed as number)++

      const podLabels = meta.labels as Record<string, string> | undefined
      const appLabel = podLabels?.app || podLabels?.['app.kubernetes.io/name']
      if (appLabel && !(nsStats[ns].labels as string[]).includes(appLabel)) {
        ;(nsStats[ns].labels as string[]).push(appLabel)
      }
    })

    const namespaces = Object.values(nsStats).map(n => ({
      ...n,
      labels: (n.labels as string[]).slice(0, 2),
    }))

    const unhealthyPods = namespaces.reduce(
      (acc, n) => acc + (n.failed as number) + (n.crash as number),
      0
    )

    console.log(
      '[Rancher] nodes:',
      nodes.length,
      'pods:',
      podsData.items.length
    )

    return NextResponse.json({
      nodes,
      namespaces,
      totalPods: podsData.items.length,
      unhealthyPods,
    })
  } catch (error: unknown) {
    console.error('[Rancher] fetch error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
