import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Evaluation' }

export default function EvaluationPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Evaluation</h1>
      <p className="text-muted-foreground text-sm">
        RAG / Embedding 평가 결과 및 신구 모델 비교
      </p>
    </div>
  )
}
