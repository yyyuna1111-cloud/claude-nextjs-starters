'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Download, ShieldCheck, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ─── 타입 ────────────────────────────────────────────────────────

interface FileMeta {
  name: string
  label: string
  folder: string
  rowCount: number
  uploadedAt: string
  size: number
  evalType: string
}

interface EvalHistoryEntry {
  rcId: string
  rcVersion: string
  evaluatedAt: string
  ragasScore: number
  passRate: number
  gate: 'Pass' | 'Fail'
}

const C = { green: '#22c55e', red: '#ef4444', blue: '#3b82f6' }

const LABEL_STYLE: Record<string, string> = {
  FAQ:       'border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50',
  Contract:  'border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/50',
  Technical: 'border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50',
  General:   'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50',
}

const EVAL_TYPE_STYLE: Record<string, string> = {
  'End-to-End': 'border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50',
  'Retrieval':  'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50',
  'Generation': 'border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50',
}

const EVAL_TYPE_LABEL: Record<string, string> = {
  'End-to-End': 'End-to-End',
  'Retrieval':  'Retrieval',
  'Generation': 'Generation',
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

const PAGE_SIZE: Record<string, number> = { card: 10, table: 10 }

function GateBadge({ gate }: { gate: 'Pass' | 'Fail' }) {
  return gate === 'Pass' ? (
    <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: C.green }}>
      <ShieldCheck className="h-3 w-3" /> Pass
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: C.red }}>
      <ShieldAlert className="h-3 w-3" /> Fail
    </span>
  )
}

// ─── 페이지 ──────────────────────────────────────────────────────

export default function TestDatasetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const key = decodeURIComponent(id)

  const [meta, setMeta] = useState<FileMeta | null>(null)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)   // 0-indexed
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'card' | 'table' | 'history'>('card')
  const [history, setHistory] = useState<EvalHistoryEntry[]>([])

  // 메타데이터: list API에서 해당 key 찾기
  useEffect(() => {
    fetch('/api/eval-dataset/list')
      .then(r => r.json())
      .then(data => {
        const file = (data.files ?? []).find((f: { key: string }) => f.key === key)
        if (file) {
          setMeta({
            name: file.name,
            label: file.label,
            folder: file.folder,
            rowCount: file.rowCount,
            uploadedAt: file.uploadedAt,
            size: file.size,
            evalType: file.evalType,
          })
        }
      })
      .catch(() => {})
  }, [key])

  // 사용 이력 조회
  useEffect(() => {
    fetch(`/api/eval-dataset/history?key=${encodeURIComponent(key)}`)
      .then(r => r.json())
      .then(data => setHistory(data.entries ?? []))
      .catch(() => {})
  }, [key])

  const pageSize = PAGE_SIZE[view]

  // 페이지별 행 조회
  const fetchRows = useCallback(async (pageIdx: number, size: number) => {
    setLoading(true)
    setError(null)
    try {
      const offset = pageIdx * size
      const res = await fetch(
        `/api/eval-dataset/preview?key=${encodeURIComponent(key)}&offset=${offset}&limit=${size}`
      )
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setRows(data.rows ?? [])
      setTotal(data.total ?? 0)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [key])

  useEffect(() => {
    fetchRows(page, pageSize)
  }, [fetchRows, page, pageSize])

  const totalPages = Math.ceil(total / pageSize)
  const hasContext = rows.length > 0 && ('contexts' in rows[0] || 'ground_truth' in rows[0])
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []

  return (
    <div className="space-y-6">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard/test-dataset" className="hover:text-foreground transition-colors">
          Test Dataset
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground font-medium truncate max-w-[300px]">
          {meta?.name ?? key.split('/').at(-1)?.replace(/^\d+_/, '')}
        </span>
      </div>

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {meta?.name ?? '데이터셋 상세'}
          </h1>
          {meta && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={cn(
                'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold',
                LABEL_STYLE[meta.label] ?? 'bg-gray-50 text-gray-700 border-gray-200'
              )}>
                {meta.label}
              </span>
              <span className={cn(
                'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold',
                EVAL_TYPE_STYLE[meta.evalType] ?? ''
              )}>
                {EVAL_TYPE_LABEL[meta.evalType] ?? meta.evalType}
              </span>
              <span className="text-sm text-muted-foreground">폴더: {meta.folder}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">
                전체 {total > 0 ? `${total.toLocaleString()}행` : meta.rowCount > 0 ? `${meta.rowCount.toLocaleString()}행` : loading ? '—행' : '0행'}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">{fmtSize(meta.size)}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">{fmtDate(meta.uploadedAt)}</span>
            </div>
          )}
        </div>
        <a
          href={`/api/eval-dataset/download?key=${encodeURIComponent(key)}&name=${encodeURIComponent(meta?.name ?? 'dataset.xlsx')}`}
        >
          <Button variant="outline" size="sm">
            <Download className="size-4 mr-1.5" />
            다운로드
          </Button>
        </a>
      </div>

      {/* 뷰 토글 + 페이지네이션 */}
      <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 rounded-lg border p-1">
              {(['card', 'table', 'history'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => { setView(v); setPage(0) }}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                    view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {v === 'card' ? '데이터' : v === 'table' ? '테이블' : '사용 이력'}
                </button>
              ))}
            </div>

          </div>

          {/* 사용 이력 뷰 */}
          {view === 'history' ? (
            <Card>
              <CardContent className="p-0">
                {history.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">평가 이력이 없습니다.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        {['RC 버전', '평가일시', 'RAGAS', '통과율', 'Gate'].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h, i) => (
                        <tr key={h.rcId ?? i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2.5 font-mono font-medium">{h.rcVersion}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{h.evaluatedAt}</td>
                          <td className="px-3 py-2.5 font-mono font-semibold" style={{ color: h.ragasScore >= 0.80 ? C.green : C.red }}>
                            {h.ragasScore.toFixed(3)}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-semibold" style={{ color: h.passRate >= 85 ? C.green : C.red }}>
                            {h.passRate}%
                          </td>
                          <td className="px-3 py-2.5"><GateBadge gate={h.gate} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

          /* 데이터 뷰 */
          ) : loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">불러오는 중...</div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-16">
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="outline" size="sm" onClick={() => fetchRows(page, pageSize)}>다시 시도</Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">데이터가 없습니다.</div>
          ) : view === 'card' ? (
            <div className="space-y-3">
              {rows.map((row, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-2">
                    <TooltipProvider delayDuration={100}>
                    {row.question && (
                      <div className="flex items-start gap-3">
                        <Tooltip><TooltipTrigger asChild>
                          <span className="text-[10px] font-bold shrink-0 mt-0.5 w-4 cursor-default" style={{ color: C.blue }}>Q</span>
                        </TooltipTrigger><TooltipContent side="left">Question</TooltipContent></Tooltip>
                        <p className="text-sm font-medium leading-relaxed">{row.question}</p>
                      </div>
                    )}
                    {row.answer && (
                      <div className="flex items-start gap-3">
                        <Tooltip><TooltipTrigger asChild>
                          <span className="text-[10px] font-bold shrink-0 mt-0.5 w-4 cursor-default" style={{ color: C.green }}>A</span>
                        </TooltipTrigger><TooltipContent side="left">Answer</TooltipContent></Tooltip>
                        <p className="text-sm text-muted-foreground leading-relaxed">{row.answer}</p>
                      </div>
                    )}
                    {row.contexts && (
                      <div className="flex items-start gap-3">
                        <Tooltip><TooltipTrigger asChild>
                          <span className="text-[10px] font-bold text-violet-500 shrink-0 mt-0.5 w-4 cursor-default">C</span>
                        </TooltipTrigger><TooltipContent side="left">Contexts</TooltipContent></Tooltip>
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{row.contexts}</p>
                      </div>
                    )}
                    {row.ground_truth && (
                      <div className="flex items-start gap-3">
                        <Tooltip><TooltipTrigger asChild>
                          <span className="text-[10px] font-bold text-emerald-500 shrink-0 mt-0.5 w-4 cursor-default">G</span>
                        </TooltipTrigger><TooltipContent side="left">Ground Truth</TooltipContent></Tooltip>
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{row.ground_truth}</p>
                      </div>
                    )}
                    {row.source && (
                      <div className="flex items-center gap-3">
                        <Tooltip><TooltipTrigger asChild>
                          <span className="text-[10px] font-bold text-orange-500 shrink-0 w-4 cursor-default">S</span>
                        </TooltipTrigger><TooltipContent side="left">Source</TooltipContent></Tooltip>
                        <span className="text-xs font-mono text-muted-foreground">{row.source}</span>
                      </div>
                    )}
                    </TooltipProvider>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-10">#</th>
                        {columns.map(col => (
                          <th key={col} className="px-3 py-2.5 text-left font-semibold text-muted-foreground">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-3 py-2.5 font-mono text-muted-foreground">{page * pageSize + i + 1}</td>
                          {columns.map(col => (
                            <td
                              key={col}
                              className={cn(
                                'px-3 py-2.5 max-w-[280px]',
                                col === 'question' && 'font-medium',
                                (col === 'answer' || col === 'contexts' || col === 'ground_truth') && 'text-muted-foreground',
                                col === 'source' && 'font-mono text-muted-foreground',
                              )}
                            >
                              <span className="block truncate" title={row[col]}>{row[col] ?? ''}</span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 하단 페이지네이션 */}
          {view !== 'history' && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-1">
              <span className="text-xs text-muted-foreground">
                {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} / {total.toLocaleString()}행
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground px-1">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
      </div>
    </div>
  )
}