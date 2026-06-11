// GET /api/scraping/workflows/[name]/logs
// Argo 로그 스트림을 브라우저로 실시간 프록시합니다.

import { NextRequest } from 'next/server'

const ARGO = process.env.ARGO

function parseLogLine(line: string): string {
  if (!line.trim()) return ''
  try {
    const obj = JSON.parse(line)
    const content = obj?.result?.content ?? obj?.content ?? line
    try {
      const inner = JSON.parse(content)
      return inner?.jsonPayload?.message ?? inner?.message ?? content
    } catch {
      return content
    }
  } catch {
    return line
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  if (!ARGO) {
    return new Response('ARGO 환경변수 없음', { status: 500 })
  }

  const podName = req.nextUrl.searchParams.get('podName')
  const url = podName
    ? `${ARGO}/api/v1/workflows/argo/${name}/log?podName=${podName}&logOptions.container=main&logOptions.follow=true`
    : `${ARGO}/api/v1/workflows/argo/${name}/log?logOptions.follow=true`

  const argoRes = await fetch(url, { cache: 'no-store' }).catch(() => null)
  if (!argoRes?.ok) {
    return new Response('', { status: 200 })
  }

  // Argo 스트림을 파싱해서 텍스트 줄로 변환 후 SSE로 전달
  const stream = new ReadableStream({
    async start(controller) {
      const reader = argoRes.body?.getReader()
      if (!reader) { controller.close(); return }
      const decoder = new TextDecoder()
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          console.log(`[logs-stream] chunk bytes=${value?.length ?? 0}`)
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            const parsed = parseLogLine(line)
            if (parsed.trim()) {
              controller.enqueue(new TextEncoder().encode(parsed + '\n'))
            }
          }
        }
      } catch { /* stream closed */ } finally {
        reader.cancel()
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Accel-Buffering': 'no' },
  })
}