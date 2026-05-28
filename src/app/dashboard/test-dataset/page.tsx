'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Upload, FolderPlus, Search, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

interface EvalFile {
  id: string
  key: string
  name: string
  label: string
  folder: string
  size: number
  uploadedAt: string
  rowCount: number
  evalType: string  // 'R+G' | 'G'
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

const FIXED_LABELS = ['FAQ', 'Technical'] as const
type FixedLabel = typeof FIXED_LABELS[number]

const LABEL_STYLE: Record<string, string> = {
  FAQ:       'border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50',
  Technical: 'border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50',
}
const LABEL_ACTIVE: Record<string, string> = {
  FAQ:       'bg-blue-500 dark:bg-blue-600 text-white border-blue-500 dark:border-blue-600',
  Technical: 'bg-amber-500 dark:bg-amber-600 text-white border-amber-500 dark:border-amber-600',
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
}

// ─── 뱃지 컴포넌트 ────────────────────────────────────────────────────────────

function LabelBadge({ label }: { label: string }) {
  const style = LABEL_STYLE[label] ?? 'bg-gray-50 text-gray-700 border-gray-200'
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${style}`}>
      {label}
    </span>
  )
}

function EvalTypeBadge({ type }: { type: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    'End-to-End': { label: 'End-to-End', cls: 'border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50' },
    'Retrieval':  { label: 'Retrieval',  cls: 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50' },
    'Generation': { label: 'Generation', cls: 'border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50' },
  }
  const { label, cls } = cfg[type] ?? cfg['Generation']
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  )
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function TestDatasetPage() {
  const router = useRouter()
  const [files, setFiles] = useState<EvalFile[]>([])
  const [extraLabels, setExtraLabels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [labelFilter, setLabelFilter] = useState('all')
  const [evalTypeFilter, setEvalTypeFilter] = useState<'all' | 'End-to-End' | 'Retrieval' | 'Generation'>('all')

  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadLabel, setUploadLabel] = useState<string>('Technical')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [folderOpen, setFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const allLabels = [...FIXED_LABELS, ...extraLabels.filter(l => !FIXED_LABELS.includes(l as FixedLabel))]

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/eval-dataset/list', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setFiles(data.files ?? [])
      setExtraLabels(data.folders ?? [])
    } catch {
      setError('목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  const pathname = usePathname()
  useEffect(() => { fetchFiles() }, [pathname, fetchFiles])

  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('label', uploadLabel)
      formData.append('folder', uploadLabel)
      const res = await fetch('/api/eval-dataset/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      setUploadOpen(false)
      setUploadFile(null)
      fetchFiles()
    } catch {
      setUploadError('업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    setCreatingFolder(true)
    try {
      const res = await fetch('/api/eval-dataset/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() }),
      })
      if (!res.ok) throw new Error()
      setFolderOpen(false)
      setNewFolderName('')
      fetchFiles()
    } catch {
      // 실패 시 무시
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, key: string) => {
    e.stopPropagation()
    if (!confirm('삭제하시겠습니까?')) return
    setDeletingKey(key)
    try {
      await fetch(`/api/eval-dataset/delete?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
      fetchFiles()
    } finally {
      setDeletingKey(null)
    }
  }

  const labelCount = allLabels.reduce((acc, l) => {
    acc[l] = files.filter(f => f.label === l).length
    return acc
  }, {} as Record<string, number>)

  const filtered = files.filter(f => {
    if (labelFilter !== 'all' && f.label !== labelFilter) return false
    if (evalTypeFilter !== 'all' && f.evalType !== evalTypeFilter) return false
    if (query && !f.name.toLowerCase().includes(query.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Eval Dataset</h1>
          <p className="text-muted-foreground mt-1 text-sm">RAG 파이프라인 평가용 테스트 데이터셋을 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFolderOpen(true)}>
            <FolderPlus className="size-4 mr-1.5" />
            폴더 생성
          </Button>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="size-4 mr-1.5" />
            업로드
          </Button>
        </div>
      </div>

      {/* 필터 */}
      <div className="space-y-2">
        {/* 라벨 필터 */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setLabelFilter('all')}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              labelFilter === 'all'
                ? 'bg-foreground text-background border-foreground'
                : 'text-muted-foreground border-border hover:border-foreground hover:text-foreground'
            )}
          >
            전체 {files.length}
          </button>
          {allLabels.map(l => (
            <button
              key={l}
              onClick={() => setLabelFilter(labelFilter === l ? 'all' : l)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                labelFilter === l
                  ? (LABEL_ACTIVE[l] ?? 'bg-gray-500 text-white border-gray-500')
                  : (LABEL_STYLE[l] ? `${LABEL_STYLE[l]} hover:opacity-80` : 'bg-gray-50 text-gray-700 border-gray-200 hover:opacity-80')
              )}
            >
              {l} {labelCount[l] ?? 0}
            </button>
          ))}
        </div>

      </div>

      {/* 테이블 */}
      <Card>
        <CardContent className="p-0">
          {/* 검색 + 평가유형 필터 */}
          <div className="px-4 py-3 border-b flex items-center gap-3">
            <div className="relative w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="파일명 검색"
                className="h-8 pl-8 text-xs"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Select value={evalTypeFilter} onValueChange={v => setEvalTypeFilter(v as 'all' | 'End-to-End' | 'Retrieval' | 'Generation')}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="평가 유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">전체 유형</SelectItem>
                <SelectItem value="End-to-End" className="text-xs">End-to-End</SelectItem>
                <SelectItem value="Retrieval" className="text-xs">Retrieval</SelectItem>
                <SelectItem value="Generation" className="text-xs">Generation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">불러오는 중...</div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchFiles}>다시 시도</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {['파일명', '라벨', '평가 유형', '크기', '업로드 일시', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        {files.length === 0 ? '업로드된 데이터셋이 없습니다.' : '검색 결과가 없습니다.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map(f => (
                      <tr
                        key={f.id}
                        className="border-b cursor-pointer transition-colors hover:bg-muted/30"
                        onClick={() => router.push(`/dashboard/test-dataset/${encodeURIComponent(f.key)}`)}
                      >
                        <td className="px-4 py-3 font-medium">{f.name}</td>
                        <td className="px-4 py-3"><LabelBadge label={f.label} /></td>
                        <td className="px-4 py-3"><EvalTypeBadge type={f.evalType} /></td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{fmtSize(f.size)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDate(f.uploadedAt)}</td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={e => handleDelete(e, f.key)}
                            disabled={deletingKey === f.key}
                            className="text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 업로드 다이얼로그 */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">테스트 데이터셋 업로드</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">라벨</Label>
              <Select value={uploadLabel} onValueChange={setUploadLabel}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allLabels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">엑셀 파일 (.xlsx)</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => document.getElementById('ds-upload-input')?.click()}
              >
                <Upload className="size-6 mx-auto text-muted-foreground mb-2" />
                {uploadFile
                  ? <p className="text-xs font-medium">{uploadFile.name}</p>
                  : <p className="text-xs text-muted-foreground">클릭하여 파일 선택</p>
                }
                <p className="text-[10px] text-muted-foreground mt-1">
                  필수: question / answer / source
                </p>
                <p className="text-[10px] text-muted-foreground">
                  선택: ground_truth_context (Retrieval 평가용)
                </p>
              </div>
              <input
                id="ds-upload-input"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setUploadOpen(false)}>취소</Button>
            <Button size="sm" disabled={!uploadFile || uploading} onClick={handleUpload}>
              {uploading ? '업로드 중...' : '업로드'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 폴더 생성 다이얼로그 */}
      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">폴더 생성</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-xs">폴더명</Label>
            <Input
              className="h-8 text-xs"
              placeholder="예: Salary, Legal"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
            />
            <p className="text-[10px] text-muted-foreground">생성 후 라벨 필터에 자동으로 추가됩니다.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFolderOpen(false)}>취소</Button>
            <Button size="sm" disabled={!newFolderName.trim() || creatingFolder} onClick={handleCreateFolder}>
              {creatingFolder ? '생성 중...' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
