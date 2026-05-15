import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Deployment / Serving' }

export default function DeploymentPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">
        Deployment / Serving
      </h1>
      <p className="text-muted-foreground text-sm">
        ONE-AI / WE-BOT / Embedding API / LLM API / RAG Pipeline 배포 상태
      </p>
    </div>
  )
}
