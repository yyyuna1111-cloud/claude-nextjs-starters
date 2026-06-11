// GET /api/scraping/workflows/[name]/logs
// Argo workflow 파드별 로그를 수집해서 합칩니다.

import { NextResponse } from 'next/server'

const ARGO = process.env.ARGO

async function fetchPodLog(wfName: string, podName: string): Promise<string[]> {
  const url = `${ARGO}/api/v1/workflows/argo/${wfName}/log?podName=${podName}&logOptions.container=main&logOptions.follow=true&logOptions.timestamps=true`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)

  let text = ''
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) {
      console.error(`[logs] fetchPodLog 실패 pod=${podName} status=${res.status}`)
      return []
    }
    const reader = res.body?.getReader()
    if (!reader) return []
    const decoder = new TextDecoder()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) text += decoder.decode(value, { stream: true })
      }
    } catch {
      // timeout — use whatever arrived so far
    } finally {
      reader.cancel()
    }
  } catch {
    // fetch itself failed
  } finally {
    clearTimeout(timer)
  }

  return text
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      try {
        const obj = JSON.parse(l)
        return obj?.result?.content ?? l
      } catch {
        return l
      }
    })
    .filter(l => l.trim())
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  if (!ARGO) {
    return NextResponse.json({ error: 'ARGO 환경변수 없음' }, { status: 500 })
  }

  try {
    // 1. 워크플로우 상세 조회 → 파드 이름 목록 추출
    const wfRes = await fetch(`${ARGO}/api/v1/workflows/argo/${name}`, { cache: 'no-store' })
    if (!wfRes.ok) {
      return NextResponse.json({ error: `워크플로우 조회 실패: ${wfRes.status}` }, { status: 500 })
    }
    const wf = await wfRes.json()
    const nodes: Record<string, { type?: string; id?: string }> = wf?.status?.nodes ?? {}

    // Pod 타입 노드만 추출 (실제 실행 컨테이너)
    const podNames = Object.values(nodes)
      .filter(n => n.type === 'Pod')
      .map(n => n.id)
      .filter(Boolean) as string[]

    // Pod 노드가 없으면 워크플로우 이름 자체로 시도
    const targets = podNames.length > 0 ? podNames : [name]

    // 2. 파드별 로그 병렬 수집
    const results = await Promise.all(targets.map(pod => fetchPodLog(name, pod)))
    const lines = results.flat()

    console.log(`[logs] 최종 lines=${lines.length}`)
    return NextResponse.json({ lines })
  } catch (e) {
    console.error('[logs] route error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}