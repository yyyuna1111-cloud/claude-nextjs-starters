import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

const K8S_API_URL = env.K8S_API_URL
const K8S_TOKEN = env.K8S_TOKEN
const PROMETHEUS_URL = `http://${env.K8S_DISPLAY_IP}:30090`

async function queryPrometheusRange(query: string, start: number, end: number, step: string) {
  try {
    const url = `${PROMETHEUS_URL}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=${step}`
    const res = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) return []
    const json = await res.json()
    return json.data?.result || []
  } catch (err) {
    console.error(`[Prometheus Range Error] ${query}:`, err)
    return []
  }
}

export async function GET() {
  try {
    if (env.K8S_SKIP_TLS_VERIFY === 'true') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    // 1. 매핑 데이터 가져오기 (노드 및 전체 Pod)
    const [nodeRes, podRes] = await Promise.all([
      fetch(`${K8S_API_URL}/api/v1/nodes`, {
        headers: { Authorization: `Bearer ${K8S_TOKEN}` },
        next: { revalidate: 0 }
      }),
      fetch(`${K8S_API_URL}/api/v1/pods`, {
        headers: { Authorization: `Bearer ${K8S_TOKEN}` },
        next: { revalidate: 0 }
      })
    ])
    
    const ipToNameMap = new Map<string, string>()
    
    // 노드 주소 매핑
    if (nodeRes.ok) {
      const nodeData = await nodeRes.json()
      nodeData.items?.forEach((node: any) => {
        const name = node.metadata?.name
        if (!name) return
        node.status?.addresses?.forEach((addr: any) => {
          if (addr.address) ipToNameMap.set(addr.address, name)
        })
        ipToNameMap.set(name, name)
      })
    }

    // Pod IP -> Node Name 매핑 (DaemonSet으로 실행 중인 익스포터 대응)
    if (podRes.ok) {
      const podData = await podRes.json()
      podData.items?.forEach((pod: any) => {
        const podIp = pod.status?.podIP
        const hostNodeName = pod.spec?.nodeName
        if (podIp && hostNodeName && !ipToNameMap.has(podIp)) {
          ipToNameMap.set(podIp, hostNodeName)
        }
      })
    }

    const now = Math.floor(Date.now() / 1000)
    const start = now - 24 * 60 * 60
    const step = '1h'

    // 쿼리 정의
    // 사용자 제공 CPU 쿼리 (node_uname_info 조인)
    const cpuQuery = '(1 - avg by (nodename) (rate(node_cpu_seconds_total{mode="idle"}[5m]) * on(instance) group_left(nodename) node_uname_info)) * 100'
    // 사용자 제공 메모리 쿼리 (node_uname_info 조인)
    const memQuery = 'sum by (nodename) (((node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100) * on(instance) group_left(nodename) node_uname_info)'
    // 사용자 제공 GPU 쿼리 (Pod 정보를 조인하여 노드별 합산)
    const gpuQuery = 'sum by (node) (DCGM_FI_DEV_GPU_UTIL * on(pod, namespace) group_left(node) kube_pod_info)'

    const [cpuResults, memResults, gpuResults] = await Promise.all([
      queryPrometheusRange(cpuQuery, start, now, step),
      queryPrometheusRange(memQuery, start, now, step),
      queryPrometheusRange(gpuQuery, start, now, step)
    ])

    const responseData: any = {
      cpu: { data: [], nodes: [] },
      memory: { data: [], nodes: [] },
      gpu: { data: [], nodes: [] }
    }

    const processMetric = (results: any[], key: 'cpu' | 'memory' | 'gpu') => {
      const timeMap = new Map<number, any>()
      const metricNodes = new Set<string>()

      results.forEach((res: any) => {
        if (!res.metric || !res.values) return

        // nodename, node, kubernetes_node, instance 순으로 식별자 추출
        let rawId = res.metric.nodename || res.metric.node || res.metric.kubernetes_node || res.metric.instance || 'unknown'
        if (rawId.includes(':')) rawId = rawId.split(':')[0]
        
        const nodeName = ipToNameMap.get(rawId) || rawId
        if (nodeName !== 'unknown') metricNodes.add(nodeName)

        res.values.forEach((v: any) => {
          if (!v || v.length < 2) return
          const ts = v[0]
          const val = v[1]
          const timeKey = Math.floor(ts / 3600) * 3600
          if (!timeMap.has(timeKey)) {
            const date = new Date(timeKey * 1000)
            timeMap.set(timeKey, { time: `${String(date.getHours()).padStart(2, '0')}:00` })
          }
          timeMap.get(timeKey)[nodeName] = Math.round(parseFloat(val))
        })
      })

      responseData[key].data = Array.from(timeMap.values()).sort((a, b) => a.time.localeCompare(b.time))
      responseData[key].nodes = Array.from(metricNodes).sort()
    }

    processMetric(cpuResults, 'cpu')
    processMetric(memResults, 'memory')
    processMetric(gpuResults, 'gpu')

    return NextResponse.json(responseData)

  } catch (error: any) {
    console.error('[Resource Trend API] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
