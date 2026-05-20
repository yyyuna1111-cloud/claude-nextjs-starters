import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '학습 코드 작성',
}

export default function TrainCodePage() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground text-sm">학습 코드 작성</p>
    </div>
  )
}
