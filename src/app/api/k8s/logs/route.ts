import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const namespace = searchParams.get('namespace') || process.env.K8S_NAMESPACE
  const podName = searchParams.get('podName')

  if (!podName) {
    return NextResponse.json({ error: 'podName is required' }, { status: 400 })
  }

  const rancherUrl = process.env.RANCHER_URL
  const clusterId = process.env.RANCHER_CLUSTER_ID
  const token = process.env.RANCHER_TOKEN

  // Rancher K8s Proxy Log API Endpoint
  const targetUrl = `${rancherUrl}/k8s/clusters/${clusterId}/api/v1/namespaces/${namespace}/pods/${podName}/log?tailLines=500`

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      // SSH 터널링/Self-signed cert 대응을 위해 (node-fetch 계열 환경용)
      // Note: Next.js fetch에서는 NODE_TLS_REJECT_UNAUTHORIZED=0 환경변수가 동작합니다.
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Rancher API Error:', errorText)
      return NextResponse.json(
        {
          error: `Rancher API failed: ${response.statusText}`,
          detail: errorText,
        },
        { status: response.status }
      )
    }

    const logs = await response.text()

    // 로그를 한 줄씩 배열로 쪼개서 반환 (프론트엔드 처리 용이)
    const logLines = logs.split('\n')

    return NextResponse.json({ logs: logLines })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Fetch Error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
