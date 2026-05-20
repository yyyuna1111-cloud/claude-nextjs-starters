// 대시보드 공통 레이아웃 - 서버 컴포넌트
// 사이드바 + 메인 콘텐츠 영역으로 구성
// Header/Footer는 대시보드에서 제외하고 사이드바 레이아웃 사용

import type { Metadata } from 'next'
import Link from 'next/link'
import { BrainCircuit } from 'lucide-react'

import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { Separator } from '@/components/ui/separator'

export const metadata: Metadata = {
  title: {
    template: '%s | MLOps Dashboard',
    default: 'MLOps Dashboard',
  },
  description: 'MLOps 대시보드 - 학습 실행, 실험 관리, 모델 배포',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-background flex min-h-screen">
      {/* 데스크탑 사이드바 - md 이상에서 표시 */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r">
        {/* 사이드바 헤더 - 로고 및 앱 이름 */}
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <BrainCircuit className="text-primary size-5" />
          <Link
            href="/dashboard"
            className="text-sm font-semibold tracking-tight transition-opacity hover:opacity-80"
          >
            MLOps Dashboard
          </Link>
        </div>

        {/* 사이드바 네비게이션 */}
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav />
        </div>

        {/* 사이드바 푸터 */}
        <div className="border-t px-4 py-3">
          <p className="text-muted-foreground text-xs">v0.1.0 - 개발 중</p>
        </div>
      </aside>

      {/* 메인 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 모바일 상단 헤더 */}
        <header className="flex h-14 items-center gap-3 border-b px-4 md:hidden">
          {/* 모바일 햄버거 메뉴 */}
          <MobileNav />
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            <BrainCircuit className="text-primary size-4" />
            <span className="text-sm font-semibold">MLOps Dashboard</span>
          </div>
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
