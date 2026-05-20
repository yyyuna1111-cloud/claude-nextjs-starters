import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Serving' }

export default function ServingPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Serving</h1>
      <p className="text-muted-foreground text-sm">
        임베딩 / LLM 서빙 현황 및 오토스케일링 모니터링
      </p>
    </div>
  )
}
