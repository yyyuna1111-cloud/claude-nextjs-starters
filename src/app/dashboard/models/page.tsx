// 모델/아티팩트 페이지 - 서버 컴포넌트 (플레이스홀더)

import type { Metadata } from 'next'
import { Box } from 'lucide-react'

export const metadata: Metadata = {
  title: '모델/아티팩트',
}

export default function ModelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">모델/아티팩트</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          학습된 모델과 아티팩트를 관리하고 배포합니다.
        </p>
      </div>

      {/* TODO: 모델 레지스트리, 버전 관리, 배포 상태 구현 예정 */}
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed">
        <Box className="text-muted-foreground/40 size-10" />
        <p className="text-muted-foreground text-sm">구현 예정</p>
      </div>
    </div>
  )
}
