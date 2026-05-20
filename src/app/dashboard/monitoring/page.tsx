import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Monitoring / Alerts' }

export default function MonitoringPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Monitoring / Alerts</h1>
      <p className="text-muted-foreground text-sm">
        실시간 메트릭, 알림 이력, 장애 이력
      </p>
    </div>
  )
}
