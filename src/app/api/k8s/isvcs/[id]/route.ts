import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

const K8S_API_URL = env.K8S_API_URL
const K8S_TOKEN = env.K8S_TOKEN

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url)
  const id = (await (params as any)).id
  const namespace = searchParams.get('ns') || 'default'

  try {
    if (env.K8S_SKIP_TLS_VERIFY === 'true') {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    }

    // 1. InferenceService 상세 정보 조회
    const isvcRes = await fetch(`${K8S_API_URL}/apis/serving.kserve.io/v1beta1/namespaces/${namespace}/inferenceservices/${id}`, {
      headers: { Authorization: `Bearer ${K8S_TOKEN}` },
      next: { revalidate: 0 }
    })

    if (!isvcRes.ok) {
      throw new Error(`ISVC not found: ${isvcRes.status}`)
    }
    const isvc = await isvcRes.json()

    // 2. 관련 Pod 목록 조회
    const podRes = await fetch(`${K8S_API_URL}/api/v1/namespaces/${namespace}/pods?labelSelector=serving.kserve.io/inferenceservice=${id}`, {
      headers: { Authorization: `Bearer ${K8S_TOKEN}` },
      next: { revalidate: 0 }
    })
    
    let pods: any[] = []
    if (podRes.ok) {
      const podData = await podRes.json()
      pods = podData.items.map((p: any) => ({
        name: p.metadata.name,
        status: p.status.phase,
        podIp: p.status.podIP || 'N/A',
        node: p.spec.nodeName || 'Pending',
        restarts: p.status.containerStatuses?.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0) || 0,
        age: p.metadata.creationTimestamp,
        images: p.spec.containers?.map((c: any) => c.image) || []
      }))
    }

    // 3. 엔진 정보 추출 및 파이썬 버전 감지
    let engine = 'Python 3'
    let mainImage = ''
    const predictor = isvc.spec?.predictor
    if (predictor) {
      const image = predictor.model?.image || (predictor.containers && predictor.containers[0]?.image) || ''
      mainImage = image
      const lowerImg = image.toLowerCase()
      if (lowerImg.includes('tei') || lowerImg.includes('text-embeddings-inference')) {
        const versionMatch = image.match(/[:\-v](\d+\.\d+)/)
        engine = versionMatch ? `TEI (v${versionMatch[1]})` : 'TEI'
      } else if (lowerImg.includes('vllm')) {
        engine = 'VLLM'
      } else {
        const versionMatch = image.match(/py(?:thon)?[:\-]?(\d+\.\d+)/i)
        if (versionMatch) {
          engine = `Python(${versionMatch[1]})`
        } else {
          const shortMatch = image.match(/py(3)(\d+)/i)
          if (shortMatch) engine = `Python(${shortMatch[1]}.${shortMatch[2]})`
          else if (lowerImg.includes('python') || lowerImg.includes('py3')) engine = 'Python 3'
        }
      }
    }

    // 4. 메트릭 조회 (Prometheus) - 30분 뷰 (1m step)
    const PROMETHEUS_URL = `http://${env.K8S_DISPLAY_IP}:30090`
    const now = Math.floor(Date.now() / 1000)
    const start = now - 30 * 60 // 최근 30분
    const step = '1m' // 1분 간격

    const queryPromRange = async (query: string) => {
      const url = `${PROMETHEUS_URL}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${now}&step=${step}`
      try {
        const res = await fetch(url, { next: { revalidate: 0 } })
        if (!res.ok) return []
        const json = await res.json()
        return json.data?.result || []
      } catch (err) {
        return []
      }
    }

    const podPattern = `${id}-predictor-.*`
    const podNames = pods.map(p => p.name)
    
    const [e413, e429, e5xx, cpu, mem, gpu, gpuMem, rps, latency, queue] = await Promise.all([
      queryPromRange(`sum by (pod) (increase(istio_requests_total{inferenceservice="${id}", response_code="413", source_workload="istio-ingressgateway"}[2m]))`),
      queryPromRange(`sum by (pod) (increase(istio_requests_total{inferenceservice="${id}", response_code="429", source_workload="istio-ingressgateway"}[2m]))`),
      queryPromRange(`sum by (pod) (increase(istio_requests_total{inferenceservice="${id}", response_code=~"5..", source_workload="istio-ingressgateway"}[2m]))`),
      queryPromRange(`(sum(rate(container_cpu_usage_seconds_total{pod=~"${podPattern}"}[2m])) by (pod) / sum(kube_pod_container_resource_limits{pod=~"${podPattern}", resource="cpu"}) by (pod)) * 100`),
      queryPromRange(`(sum(container_memory_working_set_bytes{pod=~"${podPattern}"}) by (pod) / sum(kube_pod_container_resource_limits{pod=~"${podPattern}", resource="memory"}) by (pod)) * 100`),
      queryPromRange(`sum(DCGM_FI_PROF_GR_ENGINE_ACTIVE{pod=~"${podPattern}"}) by (pod) * 100`),
      queryPromRange(`(sum(DCGM_FI_DEV_FB_USED{pod=~"${podPattern}"}) by (pod) / (sum(DCGM_FI_DEV_FB_USED{pod=~"${podPattern}"}) by (pod) + sum(DCGM_FI_DEV_FB_FREE{pod=~"${podPattern}"}) by (pod))) * 100`),
      queryPromRange(`sum(rate(istio_request_duration_milliseconds_count{pod=~"${podPattern}"}[2m])) by (pod)`), 
      queryPromRange(`histogram_quantile(0.95, sum(rate(istio_request_duration_milliseconds_bucket{pod=~"${podPattern}"}[2m])) by (le, pod))`),
      queryPromRange(`sum(tei_queue_size{pod=~"${podPattern}"}) by (pod)`)
    ])

    const transform = (results: any[], shouldFill: boolean = true) => {
      // 데이터가 아예 없는 경우 (shouldFill이 false일 때) 빈 배열 반환하여 프론트엔드에서 'No Data' 표시
      if (!shouldFill && results.length === 0) return []

      const timeMap = new Map<string, any>()
      
      // 1. 최근 30분 시계열 틀 생성 및 모든 Pod 값을 0으로 초기화
      for (let i = 0; i <= 30; i++) {
        const d = new Date((start + i * 60) * 1000)
        const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        const entry: any = { time: timeStr }
        podNames.forEach(name => { entry[name] = 0 })
        timeMap.set(timeStr, entry)
      }

      // 2. 실제 수집된 메트릭 주입
      results.forEach((res: any) => {
        const podName = res.metric.pod || 'unknown'
        res.values.forEach(([ts, val]: [number, string]) => {
          const date = new Date(ts * 1000)
          const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
          if (timeMap.has(timeStr)) {
            let numVal = parseFloat(val)
            if (isNaN(numVal)) numVal = 0
            timeMap.get(timeStr)[podName] = Math.max(0, Math.round(numVal * 1000) / 1000)
          }
        })
      })
      
      const transformed = Array.from(timeMap.values()).sort((a, b) => a.time.localeCompare(b.time))
      
      // shouldFill이 false인데 모든 값이 0인 경우에도 빈 배열 반환 (No Data 표시용)
      if (!shouldFill) {
        const hasData = results.some(res => res.values.some(([_, val]: any) => parseFloat(val) > 0))
        if (!hasData) return []
      }

      return transformed
    }

    return NextResponse.json({ 
      isvc, 
      pods, 
      engine, 
      mainImage,
      errorMetrics: { 
        error413: transform(e413, false), 
        error429: transform(e429, false), 
        error5xx: transform(e5xx, false) 
      },
      resourceMetrics: { 
        cpu: transform(cpu), 
        memory: transform(mem), 
        gpu: transform(gpu), 
        gpuMem: transform(gpuMem) 
      },
      trafficMetrics: { 
        rps: transform(rps), 
        latency: transform(latency), 
        queue: transform(queue) 
      }
    })

  } catch (error: any) {
    console.error('[K8s ISVC Detail API] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
