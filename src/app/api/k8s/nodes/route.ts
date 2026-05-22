import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import https from 'https'

const K8S_API_URL = env.K8S_API_URL
const K8S_TOKEN = env.K8S_TOKEN

export async function GET() {
  console.log(`[K8s Nodes API] Fetching from: ${K8S_API_URL}/api/v1/nodes using https module`)
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

    const data: any = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = ''
        res.on('data', (chunk) => body += chunk)
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body))
          } else {
            console.error(`[K8s Nodes API] HTTPS Error: ${res.statusCode} - ${body}`)
            reject(new Error(`K8s API responded with error: ${res.statusCode}`))
          }
        })
      })

      req.on('error', (err) => {
        console.error(`[K8s Nodes API] Request Error: ${err.message}`)
        reject(err)
      })
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('K8s API Request Timeout'))
      })
      req.end()
    })

    const items = data?.items || []

    const nodes = items.map((node: any) => {
      const name = node.metadata?.name || 'Unknown'
      const status = node.status?.conditions?.find((c: any) => c.type === 'Ready')?.status === 'True' ? 'Ready' : 'NotReady'
      const labels = node.metadata?.labels || {}
      
      let role = 'worker'
      if (labels['node-role.kubernetes.io/control-plane'] !== undefined || labels['node-role.kubernetes.io/master'] !== undefined) {
        role = 'control-plane'
      } else if (labels['nvidia.com/gpu.present'] === 'true' || labels['gpu'] === 'true') {
        role = 'gpu-worker'
      }

      // 실제 사용률은 metrics-server가 필요함. 여기선 일단 하드웨어 스펙 정도만 가져올 수 있음.
      // 실제 사용률은 /apis/metrics.k8s.io/v1beta1/nodes 에서 가져와야 함.
      
      return {
        name,
        status,
        role,
        cpuCapacity: node.status?.capacity?.cpu,
        memoryCapacity: node.status?.capacity?.memory,
        podCapacity: node.status?.capacity?.pods,
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
