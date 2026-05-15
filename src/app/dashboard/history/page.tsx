import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'History / Audit' }

export default function HistoryPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">History / Audit</h1>
      <p className="text-muted-foreground text-sm">
        학습/평가/배포/롤백 이력 및 사용자 액션 추적
      </p>
    </div>
  )
}
