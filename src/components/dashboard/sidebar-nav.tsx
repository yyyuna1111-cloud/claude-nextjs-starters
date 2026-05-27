'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Play, Server, FlaskConical, ChevronDown, Network, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/train', label: 'Train', icon: Play },
  { href: '/dashboard/serving', label: 'Service Operations', icon: Server },
  { href: '/dashboard/evaluation', label: 'RAG Evaluation', icon: FlaskConical },
  { href: '/dashboard/infrastructure', label: 'Infrastructure', icon: Network },
]

export function SidebarNav() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <nav className="flex flex-col gap-1 px-2">
      {navItems.map(item => {
        // /dashboard (Overview)는 정확히 일치할 때만 활성화, 나머지는 하위 경로 포함
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
    </nav>
  )
}
