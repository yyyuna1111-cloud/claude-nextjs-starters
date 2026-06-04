/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

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
    console.error(`[Prometheus GPU Query Error] ${query}:`, err)
    return null
  }
}

export async function GET() {
  try {
    if (env.K8S_SKIP_TLS_VERIFY === 'true') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    // 1. K8s 노드 목록 및 DCGM Exporter Pod 목록 가져오기 (매핑용)
    const [nodeRes, podRes] = await Promise.all([
      fetch(`${K8S_API_URL}/api/v1/nodes`, {
        headers: { Authorization: `Bearer ${K8S_TOKEN}` },
        next: { revalidate: 0 }
      }),
      fetch(`${K8S_API_URL}/api/v1/pods?labelSelector=app.kubernetes.io/name=dcgm-exporter`, {
        headers: { Authorization: `Bearer ${K8S_TOKEN}` },
        next: { revalidate: 0 }
      })
    ])
    
    const ipToNameMap = new Map<string, string>()
    const nodeTypeMap = new Map<string, string>() // nodeName -> gpu-standard | gpu-high

    if (nodeRes.ok) {
      const nodeData = await nodeRes.json()
      nodeData.items?.forEach((node: any) => {
        const name = node.metadata?.name
        if (!name) return
        node.status?.addresses?.forEach((addr: any) => {
          if (addr.address) ipToNameMap.set(addr.address, name)
        })
        ipToNameMap.set(name, name)
        const servingType = node.metadata?.labels?.['serving.type'] || 'gpu-standard'
        nodeTypeMap.set(name, servingType)
      })
    }

    if (podRes.ok) {
      const podData = await podRes.json()
      podData.items?.forEach((pod: any) => {
        const podIp = pod.status?.podIP
        const hostNodeName = pod.spec?.nodeName
        if (podIp && hostNodeName) {
          ipToNameMap.set(podIp, hostNodeName)
        }
      })
    }

    // 2. GPU 메트릭 가져오기
    const gpuQuery = '(DCGM_FI_DEV_FB_USED / (DCGM_FI_DEV_FB_USED + DCGM_FI_DEV_FB_FREE)) * 100'
    const [utilization, models] = await Promise.all([
      queryPrometheus(gpuQuery),
      queryPrometheus('DCGM_FI_DEV_NAME')
    ])

    if (!utilization || utilization.length === 0) {
      return NextResponse.json({ gpuNodes: [] })
    }

    // 1차 그루핑: 노드 -> GPU 인덱스 -> 메트릭 리스트
    const rawGroupMap = new Map<string, Map<number, any[]>>()

    utilization.forEach((m: any) => {
      let identifier = m.metric.kubernetes_node || m.metric.node || m.metric.instance || m.metric.hostname
      if (identifier && identifier.includes(':')) identifier = identifier.split(':')[0]
      const nodeName = ipToNameMap.get(identifier) || identifier
      const gpuIndex = parseInt(m.metric.gpu || m.metric.device || '0')

      if (!rawGroupMap.has(nodeName)) rawGroupMap.set(nodeName, new Map())
      const nodeMap = rawGroupMap.get(nodeName)!
      if (!nodeMap.has(gpuIndex)) nodeMap.set(gpuIndex, [])
      nodeMap.get(gpuIndex)!.push(m)
    })

    const gpuNodeMap = new Map<string, any>()

    rawGroupMap.forEach((nodeMap, nodeName) => {
      // 해당 노드의 메트릭들 중에서 모델명 추출 시도
      let foundModelName = 'NVIDIA Accelerator'
      for (const metrics of nodeMap.values()) {
        for (const m of metrics) {
          if (m.metric.modelName || m.metric.gpu_name) {
            foundModelName = m.metric.modelName || m.metric.gpu_name
            break
          }
        }
        if (foundModelName !== 'NVIDIA Accelerator') break
      }

      if (!gpuNodeMap.has(nodeName)) {
        gpuNodeMap.set(nodeName, {
          nodeName,
          gpuModel: foundModelName,
          servingType: nodeTypeMap.get(nodeName) || 'gpu-standard',
          gpuCount: 0,
          devices: []
        })
      }
      const nodeData = gpuNodeMap.get(nodeName)

      nodeMap.forEach((metrics, gpuIndex) => {
        const hasMig = metrics.some(m => m.metric.GPU_I_ID)
        const deviceData = {
          index: gpuIndex,
          utilization: 0,
          totalUtilization: 0,
          instances: [] as any[],
          status: 'Available'
        }

        const targetMetrics = hasMig ? metrics.filter(m => m.metric.GPU_I_ID) : metrics.slice(0, 1)

        targetMetrics.forEach(m => {
          const utilValue = parseFloat(m.value[1])
          const roundedUtil = Math.round(utilValue)
          deviceData.instances.push({
            id: m.metric.GPU_I_ID || 'default',
            profile: m.metric.GPU_I_PROFILE || 'Full',
            pod: m.metric.pod || null,
            utilization: roundedUtil
          })
          deviceData.totalUtilization += roundedUtil
        })

        deviceData.utilization = Math.min(deviceData.totalUtilization, 100)
        deviceData.status = deviceData.utilization > 5 ? 'Occupied' : 'Available'
        nodeData.devices.push(deviceData)
      })
    })

    // 모델명 상세 업데이트
    models?.forEach((m: any) => {
      let identifier = m.metric.kubernetes_node || m.metric.node || m.metric.instance || m.metric.hostname
      if (identifier && identifier.includes(':')) identifier = identifier.split(':')[0]
      const nodeName = ipToNameMap.get(identifier) || identifier
      const modelName = m.metric.gpu_name || m.metric.modelName || (m.value && m.value[1])
      
      if (nodeName && gpuNodeMap.has(nodeName) && modelName) {
        gpuNodeMap.get(nodeName).gpuModel = modelName
      }
    })

    const gpuNodes = Array.from(gpuNodeMap.values()).map((node: any) => {
      node.gpuCount = node.devices.length
      node.devices.sort((a: any, b: any) => a.index - b.index)
      return node
    })

    return NextResponse.json({ gpuNodes })

  } catch (error: any) {
    console.error('[K8s GPU API] Error:', error.message || error)
    return NextResponse.json({
      gpuNodes: [],
      error: error.message || 'Internal Server Error',
    }, { status: 500 })
  }
}
