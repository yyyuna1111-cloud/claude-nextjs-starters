'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Play, Server, FlaskConical, Box, ChevronDown, Network } from 'lucide-react'

import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/train', label: 'Train', icon: Play },
  { href: '/dashboard/serving', label: 'Serving', icon: Server },
  {
    href: '/dashboard/evaluation',
    label: 'Evaluation',
    icon: FlaskConical,
    children: [
      { href: '/dashboard/evaluation/embedding', label: '임베딩 모델', icon: Box },
      { href: '/dashboard/evaluation/rag',       label: 'RAG 평가',   icon: FlaskConical },
    ],
  },
  { href: '/dashboard/infrastructure', label: 'Infrastructure', icon: Network },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 px-2">
      {navItems.map(item => {
        // /dashboard (Overview)는 정확히 일치할 때만 활성화, 나머지는 하위 경로 포함
        const isActive = item.href === '/dashboard' 
          ? pathname === '/dashboard'
          : pathname === item.href || pathname.startsWith(item.href + '/')
        
        const Icon = item.icon
        const hasChildren = item.children && item.children.length > 0
        const isExpanded = isActive && hasChildren

        return (
          <div key={item.href}>
            <Link
              href={hasChildren ? item.children![0].href : item.href}
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
                {item.children!.map(child => {
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
    </nav>
  )
}
