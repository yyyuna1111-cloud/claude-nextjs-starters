/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

const K8S_API_URL = env.K8S_API_URL
const K8S_TOKEN = env.K8S_TOKEN

const authHeaders = {
  Authorization: `Bearer ${K8S_TOKEN}`,
  'Content-Type': 'application/json',
}

export async function POST(req: NextRequest) {
  try {
    if (env.K8S_SKIP_TLS_VERIFY === 'true') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    const body = await req.json()
    const {
      name,
      namespace = 'default',
      modelId,
      gpuCount = 1,
      tensorParallelSize,
      maxModelLen,
      dtype = 'auto',
      image = 'vllm/vllm-openai:latest',
      replicas = 1,
    } = body

    if (!name || !modelId) {
      return NextResponse.json({ error: '이름과 모델 ID는 필수입니다.' }, { status: 400 })
    }

    const tpSize = tensorParallelSize ?? gpuCount
    const deploymentName = name.startsWith('vllm-') ? name : `vllm-${name}`

    const args = [
      '--model', modelId,
      '--host', '0.0.0.0',
      '--port', '8000',
      '--tensor-parallel-size', String(tpSize),
      '--dtype', dtype,
    ]
    if (maxModelLen) args.push('--max-model-len', String(maxModelLen))

    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: deploymentName,
        namespace,
        labels: { app: 'vllm', model: name },
      },
      spec: {
        replicas,
        selector: { matchLabels: { app: 'vllm', model: name } },
        template: {
          metadata: { labels: { app: 'vllm', model: name } },
          spec: {
            containers: [{
              name: 'vllm',
              image,
              args,
              ports: [{ containerPort: 8000 }],
              resources: {
                limits: { 'nvidia.com/gpu': String(gpuCount) },
                requests: { 'nvidia.com/gpu': String(gpuCount) },
              },
              env: [
                { name: 'HF_HOME', value: '/root/.cache/huggingface' },
                { name: 'VLLM_WORKER_MULTIPROC_METHOD', value: 'spawn' },
              ],
              volumeMounts: [{ name: 'model-cache', mountPath: '/root/.cache/huggingface' }],
              readinessProbe: {
                httpGet: { path: '/health', port: 8000 },
                initialDelaySeconds: 60,
                periodSeconds: 10,
                failureThreshold: 30,
              },
            }],
            volumes: [{ name: 'model-cache', emptyDir: {} }],
            tolerations: [{ key: 'nvidia.com/gpu', operator: 'Exists', effect: 'NoSchedule' }],
          },
        },
      },
    }

    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: deploymentName,
        namespace,
        labels: { app: 'vllm', model: name },
      },
      spec: {
        selector: { app: 'vllm', model: name },
        ports: [{ name: 'http', port: 8000, targetPort: 8000 }],
        type: 'ClusterIP',
      },
    }

    const [depRes, svcRes] = await Promise.all([
      fetch(`${K8S_API_URL}/apis/apps/v1/namespaces/${namespace}/deployments`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(deployment),
        next: { revalidate: 0 },
      }),
      fetch(`${K8S_API_URL}/api/v1/namespaces/${namespace}/services`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(service),
        next: { revalidate: 0 },
      }),
    ])

    if (!depRes.ok) {
      const err = await depRes.json()
      return NextResponse.json({ error: `Deployment 생성 실패: ${err.message ?? depRes.status}` }, { status: depRes.status })
    }

    if (!svcRes.ok) {
      const err = await svcRes.json()
      // Deployment was created — note service failure but don't fail entirely
      console.warn('[LLM Deploy] Service 생성 실패:', err.message)
    }

    return NextResponse.json({ success: true, deploymentName, namespace })
  } catch (error: any) {
    console.error('[LLM Deploy API]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
