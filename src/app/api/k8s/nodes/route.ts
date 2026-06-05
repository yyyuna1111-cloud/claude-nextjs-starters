/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import https from 'https'

const K8S_API_URL = env.K8S_API_URL
const K8S_TOKEN = env.K8S_TOKEN
const PROMETHEUS_URL = `http://${env.K8S_DISPLAY_IP}:30090`

async function queryPrometheus(query: string) {
  try {
    const res = await fetch(`${PROMETHEUS_URL}/api/v1/query?query=${encodeURIComponent(query)}`, {
      next: { revalidate: 0 }
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.data?.result || []
  } catch (err) {
    console.error(`[Prometheus Query Error] ${query}:`, err)
    return null
  }
}

export async function GET() {
  try {
    if (!K8S_API_URL || !K8S_TOKEN) {
      throw new Error('Kubernetes API configuration is missing')
    }

    const url = new URL(`${K8S_API_URL}/api/v1/nodes`)
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${K8S_TOKEN}`,
        'Content-Type': 'application/json',
      },
      rejectUnauthorized: env.K8S_SKIP_TLS_VERIFY !== 'true',
      timeout: 10000,
    }

    const k8sData: any = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = ''
        res.on('data', (chunk) => body += chunk)
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body))
          } else {
            reject(new Error(`K8s API error: ${res.statusCode}`))
          }
        })
      })
      req.on('error', reject)
      req.end()
    })

    // Prometheus 메트릭 가져오기 (사용률 지표만)
    const [cpuMetrics, memMetrics, gpuMetrics] = await Promise.all([
      queryPrometheus('100 - (avg by (instance, node, kubernetes_node, nodename) (irate(node_cpu_seconds_total{mode="idle"}[2m])) * 100)'),
      queryPrometheus('avg by (instance, node, kubernetes_node, nodename) (((node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes) * 100)'),
      queryPrometheus('sum by (node, kubernetes_node, instance, nodename) (DCGM_FI_DEV_GPU_UTIL)')
    ])

    // 매핑 보강용 전체 Pod 목록 가져오기 및 노드별 개수 직접 집계
    const podRes = await fetch(`${K8S_API_URL}/api/v1/pods`, {
      headers: { Authorization: `Bearer ${K8S_TOKEN}` },
      next: { revalidate: 0 }
    })
    
    // 1. IP 매핑 테이블 및 2. 실시간 Pod 카운트 맵 생성
    const ipMap = new Map<string, string>()
    const nodePodCountMap = new Map<string, number>()

    // 노드 정보를 통한 기초 매핑
    k8sData.items?.forEach((node: any) => {
      const name = node.metadata?.name
      node.status?.addresses?.forEach((addr: any) => {
        if (addr.address) ipMap.set(addr.address, name)
      })
      ipMap.set(name, name)
    })

    // Pod 정보를 통한 매핑 보강 및 정확한 개수 집계
    if (podRes.ok) {
      const podData = await podRes.json()
      podData.items?.forEach((pod: any) => {
        const nodeName = pod.spec?.nodeName
        if (nodeName) {
          nodePodCountMap.set(nodeName, (nodePodCountMap.get(nodeName) || 0) + 1)
        }
        if (pod.status?.podIP && nodeName) {
          if (!ipMap.has(pod.status.podIP)) ipMap.set(pod.status.podIP, nodeName)
        }
      })
    }

    const mapMetricToNode = (metrics: any[]) => {
      const resultMap = new Map<string, number>()
      if (!metrics) return resultMap
      metrics.forEach((m: any) => {
        let rawId = m.metric.instance || m.metric.node || m.metric.kubernetes_node || m.metric.nodename || ''
        if (rawId.includes(':')) rawId = rawId.split(':')[0]
        let nodeName = ipMap.get(rawId) || rawId
        if (nodeName && !ipMap.has(nodeName)) {
           const short = nodeName.split('.')[0]
           if (ipMap.has(short)) nodeName = ipMap.get(short)!
        }
        if (nodeName) resultMap.set(nodeName, parseFloat(m.value[1]))
      })
      return resultMap
    }

    const cpuMap = mapMetricToNode(cpuMetrics)
    const memMap = mapMetricToNode(memMetrics)
    const gpuMap = mapMetricToNode(gpuMetrics)

    const items = k8sData?.items || []

    const findValue = (map: Map<string, number>, nodeName: string, ips: string[]) => {
      if (map.has(nodeName)) return map.get(nodeName)
      const shortName = nodeName.split('.')[0]
      if (map.has(shortName)) return map.get(shortName)
      for (const ip of ips) {
        if (map.has(ip)) return map.get(ip)
      }
      const lowerNode = nodeName.toLowerCase()
      for (const [key, val] of map.entries()) {
        if (key.toLowerCase() === lowerNode || key.toLowerCase().startsWith(lowerNode)) return val
      }
      return 0
    }

    const nodes = items.map((node: any) => {
      const name = node.metadata?.name || 'Unknown'
      const status = node.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady'
      const labels = node.metadata?.labels || {}
      const nodeIps = node.status?.addresses?.filter((a: any) => a.type === 'InternalIP' || a.type === 'ExternalIP').map((a: any) => a.address) || []

      const cpuUsage = Math.round(findValue(cpuMap, name, nodeIps) || 0)
      const memoryUsage = Math.round(findValue(memMap, name, nodeIps) || 0)
      const gpuUsageValue = Math.round(findValue(gpuMap, name, nodeIps) || 0)
      
      // 실제 K8s API로 집계한 정확한 파드 개수
      const podCount = nodePodCountMap.get(name) || 0

      let role: any = 'worker'
      const hasGpuCapacity = node.status?.capacity?.['nvidia.com/gpu'] && parseInt(node.status.capacity['nvidia.com/gpu']) > 0
      const hasGpuLabels = labels['nvidia.com/gpu.present'] === 'true' || labels['gpu'] === 'true' || labels['hardware-type'] === 'gpu'
      const isGpuByName = name.toLowerCase().includes('gpu') || name.toLowerCase().includes('nvidia')

      if (labels['node-role.kubernetes.io/control-plane'] !== undefined || labels['node-role.kubernetes.io/master'] !== undefined) {
        role = 'control-plane'
      } else if (hasGpuCapacity || hasGpuLabels || isGpuByName || gpuUsageValue > 0) {
        role = 'gpu-worker'
      }

      return {
        name,
        status,
        role,
        cpuUsage,
        memoryUsage,
        gpuUsage: gpuUsageValue,
        podCount,
        diskPressure: node.status?.conditions?.find((c: any) => c.type === 'DiskPressure')?.status === 'True',
        memoryPressure: node.status?.conditions?.find((c: any) => c.type === 'MemoryPressure')?.status === 'True',
        cpuCapacity: node.status?.capacity?.cpu,
        memoryCapacity: node.status?.capacity?.memory,
        yaml: JSON.stringify(node, null, 2),
      }
    })

    return NextResponse.json({
      nodes,
      totalCount: nodes.length,
      readyCount: nodes.filter((n: any) => n.status === 'Ready').length,
      notReadyCount: nodes.filter((n: any) => n.status === 'NotReady').length,
    })

  } catch (error: any) {
    console.error('[K8s Nodes API] Error:', error.message || error)
    return NextResponse.json({
      nodes: [],
      totalCount: 0,
      readyCount: 0,
      notReadyCount: 0,
      error: error.message || 'Internal Server Error',
    }, { status: 500 })
  }
}
