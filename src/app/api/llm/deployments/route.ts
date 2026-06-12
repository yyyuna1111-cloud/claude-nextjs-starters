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

    const [isvcData] = await Promise.all([
      k8sFetch('/apis/serving.kserve.io/v1beta1/inferenceservices?labelSelector=app%3Dvllm').catch(() => ({ items: [] })),
    ])

    const isvcs: any[] = isvcData.items || []

    const result = isvcs.map((isvc: any) => {
      const name = isvc.metadata.name
      const namespace = isvc.metadata.namespace
      const modelLabel = isvc.metadata.labels?.model || name.replace(/^vllm-/, '')

      const predictor = isvc.spec?.predictor || {}
      const replicas = predictor.minReplicas ?? 1

      // KServe status conditions
      const readyCondition = isvc.status?.conditions?.find((c: any) => c.type === 'Ready')
      const status = readyCondition?.status === 'True' ? 'Running' 
                     : (readyCondition?.status === 'Unknown' || !readyCondition) ? 'Pending' 
                     : 'NotReady'

      const readyReplicas = status === 'Running' ? replicas : 0

      // GPU count
      const containers = predictor.containers || []
      const mainContainer = containers[0] || {}
      const gpuCount = parseInt(
        mainContainer.resources?.limits?.['nvidia.com/gpu'] ?? '0', 10
      )

      // Model args
      const args: string[] = mainContainer.args || []
      const modelIdx = args.indexOf('--model')
      const modelId = modelIdx >= 0 ? args[modelIdx + 1] : modelLabel

      // URL
      const isvcUrl = isvc.status?.url || null
      const endpoint = isvcUrl

      return {
        name,
        namespace,
        modelId,
        status,
        replicas,
        readyReplicas,
        gpuCount,
        endpoint,
        isvcName: name,
        isvcNamespace: namespace,
        isvcUrl,
        createdAt: isvc.metadata.creationTimestamp,
      }
    })

    return NextResponse.json({ deployments: result })
  } catch (error: any) {
    console.error('[LLM Deployments API]', error.message)
    return NextResponse.json({ deployments: [], error: error.message }, { status: 500 })
  }
}
