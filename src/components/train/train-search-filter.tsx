'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Search, X, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const STATUS_OPTIONS = [
  { value: 'all', label: '전체 상태' },
  { value: 'Running', label: 'Running' },
  { value: 'Queued', label: 'Queued' },
  { value: 'Succeeded', label: 'Succeeded' },
  { value: 'Failed', label: 'Failed' },
  { value: 'Canceled', label: 'Canceled' },
]

const MODE_OPTIONS = [
  { value: 'all', label: '전체 모드' },
  { value: '단일 GPU', label: '단일 GPU' },
  { value: '분산 학습', label: '분산 학습' },
  { value: 'CPU 전용', label: 'CPU 전용' },
]

export function TrainSearchFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const q = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? 'all'
  const mode = searchParams.get('mode') ?? 'all'
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    fromParam
      ? { from: new Date(fromParam), to: toParam ? new Date(toParam) : undefined }
      : undefined
  )

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (!value || value === 'all') params.delete(key)
      else params.set(key, value)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  function handleDateSelect(range: DateRange | undefined) {
    setDateRange(range)
    const params = new URLSearchParams(searchParams.toString())
    if (range?.from) params.set('from', format(range.from, 'yyyy-MM-dd'))
    else params.delete('from')
    if (range?.to) params.set('to', format(range.to, 'yyyy-MM-dd'))
    else params.delete('to')
    router.push(`${pathname}?${params.toString()}`)
  }

  const hasFilters = q || status !== 'all' || mode !== 'all' || fromParam

  function clearAll() {
    setDateRange(undefined)
    router.push(pathname)
  }

  const dateLabel = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, 'MM/dd')} – ${format(dateRange.to, 'MM/dd')}`
      : format(dateRange.from, 'MM/dd')
    : '기간 선택'

  return (
    <div className="flex items-center gap-2">
      {/* 텍스트 검색 */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
        <Input
          placeholder="학습명, 프로젝트, 요청자..."
          className="h-8 w-[190px] pl-8 text-xs"
          defaultValue={q}
          onChange={e => {
            const val = e.target.value
            clearTimeout((window as Window & { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer)
            ;(window as Window & { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer = setTimeout(
              () => updateParam('q', val),
              300
            )
          }}
        />
      </div>

      {/* 상태 필터 */}
      <Select value={status} onValueChange={val => updateParam('status', val)}>
        <SelectTrigger className="h-8 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 학습 모드 필터 */}
      <Select value={mode} onValueChange={val => updateParam('mode', val)}>
        <SelectTrigger className="h-8 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MODE_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 날짜 범위 필터 */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs font-normal"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            <span className={dateRange?.from ? '' : 'text-muted-foreground'}>
              {dateLabel}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={handleDateSelect}
            locale={ko}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>

      {/* 필터 초기화 */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="text-muted-foreground h-8 gap-1 px-2 text-xs"
        >
          <X className="h-3 w-3" />
          초기화
        </Button>
      )}
    </div>
  )
}