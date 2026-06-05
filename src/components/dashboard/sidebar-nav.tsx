'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { LayoutDashboard, GitBranch, Server, ShieldCheck, ChevronDown, Network, Sun, Moon, Database, HardDrive, Package, BookOpen, LogOut } from 'lucide-react'
import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/hooks/use-current-user'

const adminNavItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/serving', label: 'Service Operation', icon: Server },
  { href: '/dashboard/deployments', label: 'Deployment Timelines', icon: GitBranch },
  { href: '/dashboard/evaluation', label: '퀄리티 게이트', icon: ShieldCheck },
  { href: '/dashboard/scraping', label: 'Data Scraping', icon: Database },
  { href: '/dashboard/infrastructure', label: 'Infrastructure', icon: Network },
  { href: '/dashboard/storage', label: 'Storage', icon: HardDrive },
  { href: '/dashboard/jupyter', label: 'Jupyter', icon: BookOpen },
  { href: '/dashboard/registry', label: 'Registry', icon: Package },
]

const userNavItems = [
  { href: '/dashboard/storage', label: 'Storage', icon: HardDrive },
  { href: '/dashboard/jupyter', label: 'Jupyter', icon: BookOpen },
  { href: '/dashboard/registry', label: 'Registry', icon: Package },
]

export function SidebarNav() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { user, isAdmin, logout } = useCurrentUser()
  const [mounted, setMounted] = React.useState(false)

  const navItems = isAdmin ? adminNavItems : userNavItems

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <nav className="flex flex-col gap-1 px-2 h-full">
      <div className="flex-1">
        {navItems.map(item => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === item.href || pathname.startsWith(item.href + '/')

          const Icon = item.icon
          const hasChildren = (item as any).children && (item as any).children.length > 0
          const isExpanded = isActive && hasChildren

          return (
            <div key={item.href}>
              <Link
                href={hasChildren ? (item as any).children![0].href : item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {hasChildren && <ChevronDown className={cn('size-3.5 transition-transform', isExpanded && 'rotate-180')} />}
              </Link>

              {isExpanded && (
                <div className="mt-0.5 ml-3 flex flex-col gap-0.5 border-l pl-3" style={{ borderColor: 'hsl(var(--border))' }}>
                  {(item as any).children!.map((child: any) => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                    const ChildIcon = child.icon
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                          childActive
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <ChildIcon className="size-3.5 shrink-0" />
                        <span>{child.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="px-3 mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Appearance</p>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                'w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                mounted && theme === 'light'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Sun className="size-4 shrink-0" />
              <span>Light Mode</span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                'w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                mounted && theme === 'dark'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Moon className="size-4 shrink-0" />
              <span>Dark Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* 유저 정보 + 로그아웃 */}
      {user && (
        <div className="mt-2 pt-3 border-t border-border/50 px-1">
          <div className="flex items-center justify-between rounded-md px-2 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0">
                {user.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium truncate">{user}</span>
                {isAdmin && <span className="text-[10px] text-primary font-bold">관리자</span>}
              </div>
            </div>
            <button
              onClick={logout}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-2"
              title="로그아웃"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
