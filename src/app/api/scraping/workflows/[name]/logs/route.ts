// GET /api/scraping/workflows/[name]/logs
// 실행 중: k8s API 직접 호출로 pod 로그 스트리밍
// 완료 후: S3 아카이브 (tax-new/tax-logs/)

import { NextRequest, NextResponse } from 'next/server'
import https from 'https'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { env } from '@/lib/env'

const ARGO = process.env.ARGO
const K8S_API_URL = env.K8S_API_URL
const K8S_TOKEN = env.K8S_TOKEN
const SKIP_TLS = env.K8S_SKIP_TLS_VERIFY === 'true'

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.SEAWEEDFS_ACCESS_KEY ?? 'any',
    secretAccessKey: process.env.SEAWEEDFS_SECRET_KEY ?? 'any',
  },
  forcePathStyle: true,
})

const BUCKET = process.env.S3_LOG_BUCKET ?? 'tax-new'
const LOG_PREFIX = 'tax-logs'

async function fetchS3Logs(name: string): Promise<{ pod: string; lines: string[] }[]> {
  const listRes = await s3.send(new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: `${LOG_PREFIX}/${name}/`,
  }))
  const logKeys = (listRes.Contents ?? [])
    .filter(o => o.Key?.endsWith('main.log'))
    .map(o => o.Key!)
    .sort()
  if (logKeys.length === 0) return []
  return Promise.all(logKeys.map(async key => {
    const podName = key.split('/')[2] ?? key
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
      const text = await res.Body?.transformToString('utf-8') ?? ''
      return { pod: podName, lines: text.split('\n').filter(l => l.trim()) }
    } catch {
      return { pod: podName, lines: [] }
    }
  }))
}

function fetchK8sLogs(podName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${K8S_API_URL}/api/v1/namespaces/argo/pods/${podName}/log?container=main&tailLines=500`)
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { Authorization: `Bearer ${K8S_TOKEN}` },
      rejectUnauthorized: !SKIP_TLS,
      timeout: 8000,
    }
    const req = https.request(options, res => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => resolve(body))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params

  // 워크플로우 상태 및 pod 목록 조회
  let phase = 'Unknown'
  let pods: { id: string; displayName: string }[] = []

  if (ARGO) {
    try {
      const wfRes = await fetch(`${ARGO}/api/v1/workflows/argo/${name}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      })
      if (wfRes.ok) {
        const wf = await wfRes.json()
        phase = wf?.status?.phase ?? 'Unknown'
        const nodes: Record<string, { type?: string; id?: string; displayName?: string }> = wf?.status?.nodes ?? {}
        pods = Object.values(nodes)
          .filter(n => n.type === 'Pod' && n.id)
          .map(n => ({ id: n.id!, displayName: n.displayName ?? n.id! }))
      }
    } catch { /* ignore */ }
  }

  // 완료된 워크플로우 → S3 아카이브
  if (phase === 'Succeeded' || phase === 'Failed' || phase === 'Error') {
    const s3Logs = await fetchS3Logs(name).catch(() => [])
    return NextResponse.json({ logs: s3Logs.filter(l => l.lines.length > 0), source: 's3' })
  }

  // 실행 중 → k8s label selector로 pod 목록 조회 후 로그
  try {
    const podListUrl = new URL(`${K8S_API_URL}/api/v1/namespaces/argo/pods`)
    podListUrl.searchParams.set('labelSelector', `workflows.argoproj.io/workflow=${name}`)
    const podListText = await new Promise<string>((resolve, reject) => {
      const url = podListUrl
      const options: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'GET',
        headers: { Authorization: `Bearer ${K8S_TOKEN}` },
        rejectUnauthorized: !SKIP_TLS,
        timeout: 5000,
      }
      const req = https.request(options, res => {
        let body = ''
        res.on('data', chunk => body += chunk)
        res.on('end', () => resolve(body))
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
      req.end()
    })

    const podList = JSON.parse(podListText)
    const k8sPods: { name: string }[] = (podList.items ?? []).map((p: Record<string, unknown>) => ({
      name: (p.metadata as Record<string, unknown>)?.name as string,
    }))

    if (k8sPods.length === 0) return NextResponse.json({ logs: [], source: 'none' })

    const results = await Promise.all(k8sPods.map(async pod => {
      try {
        const text = await fetchK8sLogs(pod.name)
        return { pod: pod.name, lines: text.split('\n').filter(l => l.trim()) }
      } catch {
        return { pod: pod.name, lines: [] }
      }
    }))

    return NextResponse.json({ logs: results.filter(r => r.lines.length > 0), source: 'k8s' })
  } catch (e) {
    console.error('[logs] k8s pod 조회 실패:', e)
    return NextResponse.json({ logs: [], source: 'error' })
  }
}
