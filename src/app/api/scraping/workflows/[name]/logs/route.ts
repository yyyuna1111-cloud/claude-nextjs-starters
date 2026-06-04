// GET /api/scraping/workflows/[name]/logs
// Argo workflow 파드별 로그를 수집해서 합칩니다.

import { NextResponse } from 'next/server'

const ARGO = process.env.ARGO

async function fetchPodLog(wfName: string, podName: string): Promise<string[]> {
  const url = `${ARGO}/api/v1/workflows/argo/${wfName}/log?podName=${podName}&logOptions.follow=false&logOptions.timestamps=true`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return []
  const text = await res.text()
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

    return NextResponse.json({ lines })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}