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
      namespace = 'datascience-storage',
      modelId,
      gpuCount = 1,
      tensorParallelSize,
      maxModelLen,
      dtype = 'auto',
      image = '10.70.170.227:80/model-serving/vllm-openai:v0.19.1',
      replicas = 1,
      cpu,
      memory,
      pvcName = 'shared-sllm',
    } = body

    if (!name || !modelId) {
      return NextResponse.json({ error: '이름과 모델 ID는 필수입니다.' }, { status: 400 })
    }

    const tpSize = tensorParallelSize ?? gpuCount
    const isvcName = name.startsWith('vllm-') ? name : `vllm-${name}`

    const args = [
      '--model', modelId,
      '--host', '0.0.0.0',
      '--port', '8080',
      '--tensor-parallel-size', String(tpSize),
      '--dtype', dtype,
    ]
    if (maxModelLen) args.push('--max-model-len', String(maxModelLen))

    const isvc = {
      apiVersion: 'serving.kserve.io/v1beta1',
      kind: 'InferenceService',
      metadata: {
        name: isvcName,
        namespace,
        labels: { app: 'vllm', model: name },
        annotations: {
          'prometheus.io/path': '/metrics',
          'prometheus.io/port': '8080',
          'prometheus.io/scheme': 'http',
          'prometheus.io/scrape': 'true',
          'serving.kserve.io/deploymentMode': 'Standard',
          'serving.kserve.io/enable-prometheus-scraping': 'true',
        },
      },
      spec: {
        predictor: {
          annotations: {
            'sidecar.istio.io/inject': 'true',
          },
          minReplicas: replicas,
          maxReplicas: replicas,
          runtimeClassName: 'nvidia',
          tolerations: [{ key: 'nvidia.com/gpu', operator: 'Exists', effect: 'NoSchedule' }],
          volumes: [
            { name: 'model-storage', persistentVolumeClaim: { claimName: pvcName } },
            { name: 'model-cache', emptyDir: {} },
          ],
          containers: [{
            name: 'kserve-container',
            image,
            args,
            env: [
              { name: 'HF_HOME', value: '/root/.cache/huggingface' },
              { name: 'VLLM_WORKER_MULTIPROC_METHOD', value: 'spawn' },
            ],
            ports: [{ containerPort: 8080, protocol: 'TCP' }],
            resources: {
              requests: { 
                cpu: String(cpu || gpuCount * 4),
                memory: `${memory || gpuCount * 32}Gi`,
                'nvidia.com/gpu': String(gpuCount) 
              },
              limits: { 
                cpu: String(cpu || gpuCount * 8),
                memory: `${memory || gpuCount * 64}Gi`,
                'nvidia.com/gpu': String(gpuCount) 
              },
            },
            volumeMounts: [
              { mountPath: '/mnt/models', name: 'model-storage' },
              { mountPath: '/root/.cache/huggingface', name: 'model-cache' },
            ],
            readinessProbe: {
              httpGet: { path: '/health', port: 8080 },
              initialDelaySeconds: 60,
              periodSeconds: 10,
              failureThreshold: 30,
            },
          }],
        },
      },
    }

    const res = await fetch(`${K8S_API_URL}/apis/serving.kserve.io/v1beta1/namespaces/${namespace}/inferenceservices`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(isvc),
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: `InferenceService 생성 실패: ${err.message ?? res.status}` }, { status: res.status })
    }

    return NextResponse.json({ success: true, deploymentName: isvcName, namespace })
  } catch (error: any) {
    console.error('[LLM Deploy API]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
