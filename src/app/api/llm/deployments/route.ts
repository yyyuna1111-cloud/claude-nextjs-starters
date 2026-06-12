/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

const K8S_API_URL = env.K8S_API_URL
const K8S_TOKEN = env.K8S_TOKEN

const k8sHeaders = {
  Authorization: `Bearer ${K8S_TOKEN}`,
  'Content-Type': 'application/json',
}
const fetchOpts = { headers: k8sHeaders, next: { revalidate: 0 } }

async function k8sFetch(path: string) {
  const res = await fetch(`${K8S_API_URL}${path}`, fetchOpts)
  if (!res.ok) throw new Error(`K8s API ${path} → ${res.status}`)
  return res.json()
}

export async function GET() {
  try {
    if (env.K8S_SKIP_TLS_VERIFY === 'true') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    const [deploymentsData, servicesData, isvcData] = await Promise.all([
      k8sFetch('/apis/apps/v1/deployments?labelSelector=app%3Dvllm').catch(() => ({ items: [] })),
      k8sFetch('/api/v1/services?labelSelector=app%3Dvllm').catch(() => ({ items: [] })),
      k8sFetch('/apis/serving.kserve.io/v1beta1/inferenceservices').catch(() => ({ items: [] })),
    ])

    const deployments: any[] = deploymentsData.items || []
    const services: any[] = servicesData.items || []
    const isvcs: any[] = isvcData.items || []

    // Build service map: namespace/name → clusterIP, port
    const serviceMap = new Map<string, any>()
    services.forEach((svc: any) => {
      const key = `${svc.metadata.namespace}/${svc.metadata.name}`
      serviceMap.set(key, svc)
    })

    // Build ISVC map: name → isvc (for connection display)
    const isvcMap = new Map<string, any>()
    isvcs.forEach((isvc: any) => {
      isvcMap.set(isvc.metadata.name, isvc)
      // Also try matching by model label
      const model = isvc.metadata.labels?.model
      if (model) isvcMap.set(model, isvc)
    })

    const result = deployments.map((dep: any) => {
      const name = dep.metadata.name
      const namespace = dep.metadata.namespace
      const modelLabel = dep.metadata.labels?.model || name.replace(/^vllm-/, '')
      const replicas = dep.spec?.replicas ?? 1
      const readyReplicas = dep.status?.readyReplicas ?? 0
      const unavailable = dep.status?.unavailableReplicas ?? 0

      const status = readyReplicas > 0 ? 'Running' : unavailable > 0 ? 'Pending' : 'NotReady'

      // GPU count from container resources
      const containers = dep.spec?.template?.spec?.containers || []
      const mainContainer = containers[0] || {}
      const gpuCount = parseInt(
        mainContainer.resources?.limits?.['nvidia.com/gpu'] ?? '0', 10
      )

      // Model args (--model flag)
      const args: string[] = mainContainer.args || []
      const modelIdx = args.indexOf('--model')
      const modelId = modelIdx >= 0 ? args[modelIdx + 1] : modelLabel

      // Service endpoint
      const svc = serviceMap.get(`${namespace}/${name}`) || serviceMap.get(`${namespace}/vllm-${modelLabel}`)
      const port = svc?.spec?.ports?.[0]?.port ?? 8000
      const clusterIP = svc?.spec?.clusterIP
      const endpoint = clusterIP ? `http://${clusterIP}:${port}` : null

      // ISVC connection
      const linkedIsvc = isvcMap.get(name) || isvcMap.get(modelLabel) || isvcMap.get(`vllm-${modelLabel}`)
      const isvcName = linkedIsvc?.metadata?.name ?? null
      const isvcNamespace = linkedIsvc?.metadata?.namespace ?? null
      const isvcUrl = linkedIsvc?.status?.url ?? null

      return {
        name,
        namespace,
        modelId,
        status,
        replicas,
        readyReplicas,
        gpuCount,
        endpoint,
        isvcName,
        isvcNamespace,
        isvcUrl,
        createdAt: dep.metadata.creationTimestamp,
      }
    })

    return NextResponse.json({ deployments: result })
  } catch (error: any) {
    console.error('[LLM Deployments API]', error.message)
    return NextResponse.json({ deployments: [], error: error.message }, { status: 500 })
  }
}
