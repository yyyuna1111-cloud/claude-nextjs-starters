'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { value: 'all', label: '전체' },
  { value: 'train', label: '학습' },
  { value: 'evaluate', label: '평가' },
]

export function TrainFilterTabs() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = searchParams.get('type') ?? 'all'

  function handleClick(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') params.delete('type')
    else params.set('type', value)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex gap-1 rounded-lg border p-1">
      {TABS.map(tab => (
        <button
          key={tab.value}
          onClick={() => handleClick(tab.value)}
          className={cn(
            'rounded-md px-3 py-1 text-sm transition-colors',
            current === tab.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
