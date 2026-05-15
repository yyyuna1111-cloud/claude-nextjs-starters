'use client'

// 대시보드 사이드바 네비게이션 - 클라이언트 컴포넌트
// 현재 경로에 따라 활성 메뉴 항목을 강조 표시하기 위해 usePathname 사용

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Play } from 'lucide-react'

import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/train', label: 'Train', icon: Play },
]

// 사이드바 내부 링크 목록 컴포넌트
export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 px-2">
      {navItems.map(item => {
        // 현재 경로가 메뉴 항목 경로와 일치하는지 확인
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + '/')
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
