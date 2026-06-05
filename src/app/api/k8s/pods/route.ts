/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import https from 'https'

const K8S_API_URL = env.K8S_API_URL
const K8S_TOKEN = env.K8S_TOKEN

export async function GET() {
  try {
    if (!K8S_API_URL || !K8S_TOKEN) {
      throw new Error('Kubernetes API configuration is missing')
    }

    const url = new URL(`${K8S_API_URL}/api/v1/pods`)
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
            reject(new Error(`K8s API responded with error: ${res.statusCode}`))
          }
        })
      })

      req.on('error', (err) => reject(err))
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('K8s API Request Timeout'))
      })
      req.end()
    })

    const items = data?.items || []

    let runningCount = 0
    let pendingCount = 0
    let completedCount = 0
    let failedCount = 0
    let crashLoopCount = 0
    let otherCount = 0

    items.forEach((pod: any) => {
      const phase = pod.status?.phase
      const containerStatuses = pod.status?.containerStatuses || []
      const isTerminating = !!pod.metadata?.deletionTimestamp
      
      // CrashLoopBackOff 판별
      const isCrashLoop = containerStatuses.some((cs: any) => cs.state?.waiting?.reason === 'CrashLoopBackOff')

      if (isTerminating) {
        otherCount++ // 삭제 중인 포드는 기타(Terminating)로 분류
      } else if (isCrashLoop) {
        crashLoopCount++
      } else if (phase === 'Running') {
        runningCount++
      } else if (phase === 'Pending') {
        pendingCount++
      } else if (phase === 'Succeeded') {
        completedCount++
      } else if (phase === 'Failed') {
        failedCount++
      } else {
        otherCount++ // Unknown 등 그 외 모든 상태
      }
    })

    const pods = items.map((pod: any) => {
      const containerStatuses = pod.status?.containerStatuses || []
      const restarts = containerStatuses.reduce((sum: number, cs: any) => sum + cs.restartCount, 0)
      const creationTimestamp = pod.metadata?.creationTimestamp
      const age = creationTimestamp ? calculateAge(creationTimestamp) : 'Unknown'

      let status = pod.status?.phase || 'Unknown'
      if (pod.metadata?.deletionTimestamp) {
        status = 'Terminating'
      } else {
        const crashLoop = containerStatuses.find((cs: any) => cs.state?.waiting?.reason === 'CrashLoopBackOff')
        if (crashLoop) status = 'CrashLoopBackOff'
      }

      return {
        namespace: pod.metadata?.namespace || 'default',
        name: pod.metadata?.name || 'Unknown',
        status,
        restarts,
        node: pod.spec?.nodeName || '-',
        hasGpu: containerStatuses.some((cs: any) => 
          cs.resources?.limits?.['nvidia.com/gpu'] || 
          cs.resources?.requests?.['nvidia.com/gpu']
        ),
        age,
        yaml: JSON.stringify(pod, null, 2),
      }
    })

    return NextResponse.json({
      pods,
      totalCount: items.length,
      runningCount,
      pendingCount,
      completedCount,
      failedCount,
      crashLoopCount,
      otherCount,
    })
    } catch (error: any) {
    console.error('[K8s Pods API] Error:', error.message || error)
    return NextResponse.json({
      pods: [],
      totalCount: 0,
      runningCount: 0,
      pendingCount: 0,
      failedCount: 0,
      crashLoopCount: 0,
      otherCount: 0,
      error: error.message || 'Internal Server Error',
    }, { status: 500 })
    }
    }

    function calculateAge(timestamp: string): string {
    const diff = Date.now() - new Date(timestamp).getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    const minutes = Math.floor((diff / (1000 * 60)) % 60)

    if (days > 0) return `${days}d`
    if (hours > 0) return `${hours}h`
    return `${minutes}m`
    }

