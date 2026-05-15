'use client'

// 모바일 네비게이션 - 클라이언트 컴포넌트
// 모바일 환경에서 햄버거 버튼으로 Sheet 사이드바를 열기 위해 상태 관리 필요

import { useState } from 'react'
import { MenuIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {/* 햄버거 버튼 - 모바일에서만 표시 */}
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 md:hidden"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
      >
        <MenuIcon className="size-5" />
      </Button>

      {/* 모바일 사이드바 Sheet */}
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b px-4 py-4">
          <SheetTitle className="text-left text-base font-semibold">
            MLOps Dashboard
          </SheetTitle>
        </SheetHeader>
        {/* 클릭 시 Sheet 닫힘 처리 */}
        <div onClick={() => setOpen(false)} className="py-4">
          <SidebarNav />
        </div>
      </SheetContent>
    </Sheet>
  )
}
