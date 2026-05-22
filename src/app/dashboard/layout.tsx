'use client'

import * as React from 'react'
import Link from 'next/link'
import { BrainCircuit, Globe } from 'lucide-react'
import { useEnv } from '@/components/providers/env-provider'
import { Badge } from '@/components/ui/badge'

import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { MobileNav } from '@/components/dashboard/mobile-nav'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { env, setEnv, clusterIp } = useEnv()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="bg-background flex min-h-screen text-foreground">
      {/* 데스크탑 사이드바 - md 이상에서 표시 */}
      <aside className="bg-sidebar text-sidebar-foreground hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r">
        {/* 사이드바 헤더 - 로고 및 앱 이름 */}
        <div className="flex h-16 items-center gap-3 border-b px-4">
          <BrainCircuit className="text-primary size-6" />
          <div className="flex flex-col leading-tight">
            <Link
              href="/dashboard"
              className="text-sm font-bold tracking-tight transition-opacity hover:opacity-80"
            >
              MLOps Dashboard
            </Link>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground/60 font-medium">v0.1.0</span>
            </div>
          </div>
        </div>

        {/* 환경 전환 토글 섹션 */}
        <div className="px-4 py-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center justify-between rounded-lg border bg-card p-2 text-left transition-colors hover:bg-accent/50 group">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className={cn(
                      "size-1.5 rounded-full",
                      env === 'DEV' ? "bg-emerald-500 animate-pulse" : "bg-destructive"
                    )} />
                    <span className="text-[11px] font-bold uppercase tracking-wider">{env} Environment</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                    <Globe className="size-3" />
                    {mounted ? clusterIp : '---.---.---.---'}
                  </div>
                </div>
                <Badge variant="outline" className="h-5 px-1 text-[9px] group-hover:bg-background">Change</Badge>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs">Select Environment</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setEnv('DEV')} className="flex flex-col items-start gap-0.5 py-2">
                <div className="flex items-center gap-2 font-bold">
                  <div className="size-2 rounded-full bg-emerald-500" />
                  Development (DEV)
                </div>
                <span className="text-[10px] text-muted-foreground font-mono ml-4">10.70.171.187</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEnv('OPS')} className="flex flex-col items-start gap-0.5 py-2">
                <div className="flex items-center gap-2 font-bold text-destructive">
                  <div className="size-2 rounded-full bg-destructive" />
                  Operations (OPS)
                </div>
                <span className="text-[10px] text-muted-foreground font-mono ml-4">0.0.0.0</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 사이드바 네비게이션 */}
        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav />
        </div>

        {/* 사이드바 푸터 */}
        <div className="border-t px-4 py-3">
          <p className="text-[10px] text-muted-foreground truncate">Connected: {env} Mode</p>
        </div>
      </aside>

      {/* 메인 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 모바일 상단 헤더 */}
        <header className="flex h-14 items-center justify-between border-b px-4 md:hidden">
          <div className="flex items-center gap-3">
            <MobileNav />
            <Separator orientation="vertical" className="h-5" />
            <div className="flex flex-col leading-none">
              <span className="text-xs font-bold">MLOps Dashboard</span>
              <div className="flex items-center gap-1 mt-0.5">
                <div className={cn(
                  "size-1 rounded-full",
                  env === 'DEV' ? "bg-emerald-500" : "bg-destructive"
                )} />
                <span className="text-[9px] font-mono text-muted-foreground uppercase">{env} : {mounted ? clusterIp : '...'}</span>
              </div>
            </div>
          </div>
          <ThemeToggle />
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}
