'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  HardDrive,
  FolderOpen,
  Folder,
  File,
  FileText,
  FileImage,
  FileArchive,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  ChevronRight,
  Home,
  Share2,
  Database,
  AlertCircle,
  Copy,
  FolderPlus,
  ClipboardPaste,
} from 'lucide-react'
import { useCurrentUser } from '@/hooks/use-current-user'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface PVC {
  name: string
  namespace: string
  capacity: string
  capacityBytes: number
  status: string
  type: 'personal' | 'shared'
  user: string | null
  createdAt: string
  volumeName: string  // 실제 S3 버킷명 (PV 이름 = pvc-{uuid} 또는 PVC 이름)
}

interface BucketStat {
  name: string
  totalSize: number
  fileCount: number
}

interface BrowseEntry {
  key: string
  name: string
  size: number
  lastModified: string
}

interface BrowseFolder {
  name: string
  prefix: string
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext ?? '')) return FileImage
  if (['zip', 'tar', 'gz', 'bz2', 'xz'].includes(ext ?? '')) return FileArchive
  if (['txt', 'md', 'csv', 'json', 'yaml', 'yml', 'log'].includes(ext ?? '')) return FileText
  return File
}

function formatDate(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── 사용량 모니터링 ─────────────────────────────────────────────────────────

function UsageMonitor({ currentUser, isAdmin }: { currentUser: string; isAdmin: boolean }) {
  const [pvcs, setPvcs] = useState<PVC[]>([])
  const [bucketStats, setBucketStats] = useState<Record<string, BucketStat>>({})
  const [pvcLoading, setPvcLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPvcs = useCallback(async () => {
    setPvcLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/storage/pvcs')
      const data = await res.json()
      if (data.error && data.pvcs.length === 0) setError(data.error)
      setPvcs(data.pvcs ?? [])
    } catch {
      setError('PVC 조회 실패')
    } finally {
      setPvcLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await fetch('/api/storage/buckets')
      const data = await res.json()
      const map: Record<string, BucketStat> = {}
      for (const b of data.buckets ?? []) map[b.name] = b
      setBucketStats(map)
    } catch {
      // stats optional
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPvcs()
    fetchStats()
  }, [fetchPvcs, fetchStats])

  const visiblePvcs = isAdmin ? pvcs : pvcs.filter(p => p.type === 'shared' || p.user === currentUser)
  const totalAllocated = visiblePvcs.reduce((s, p) => s + p.capacityBytes, 0)
  const personalPvcs = visiblePvcs.filter(p => p.type === 'personal')
  const sharedPvcs = visiblePvcs.filter(p => p.type === 'shared')
  const sharedAllocated = sharedPvcs.reduce((s, p) => s + p.capacityBytes, 0)
  const totalUsed = Object.values(bucketStats).reduce((s, b) => s + b.totalSize, 0)

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">총 할당 용량</CardTitle>
          </CardHeader>
          <CardContent>
            {pvcLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-2xl font-bold">{formatBytes(totalAllocated)}</p>
                <p className="text-xs text-muted-foreground mt-1">{visiblePvcs.length}개 PVC</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">개인 스토리지</CardTitle>
          </CardHeader>
          <CardContent>
            {pvcLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-2xl font-bold">{personalPvcs.length}명</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatBytes(personalPvcs.reduce((s, p) => s + p.capacityBytes, 0))} 할당
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">공유 스토리지</CardTitle>
          </CardHeader>
          <CardContent>
            {pvcLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-2xl font-bold">{formatBytes(sharedAllocated)}</p>
                <p className="text-xs text-muted-foreground mt-1">{sharedPvcs.length}개 버킷</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">실제 사용량</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <p className="text-2xl font-bold">{formatBytes(totalUsed)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalAllocated > 0
                    ? `${((totalUsed / totalAllocated) * 100).toFixed(1)}% 사용`
                    : '측정 중'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>K8s 연결 오류: {error}</span>
        </div>
      )}

      {/* PVC 테이블 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-semibold">PVC 목록 (datascience-storage)</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { fetchPvcs(); fetchStats() }}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className="size-3" />
            새로고침
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">PVC 이름</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>할당 용량</TableHead>
                <TableHead>실사용량</TableHead>
                <TableHead>파일 수</TableHead>
                <TableHead>사용률</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pvcLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : visiblePvcs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    PVC가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                visiblePvcs.map(pvc => {
                  // volumeName = PV 이름(pvc-{uuid}), 없으면 PVC 이름으로 폴백
                  const bucketKey = pvc.volumeName || pvc.name
                  const stat = bucketStats[bucketKey]
                  const usedBytes = stat?.totalSize ?? 0
                  const usePct = pvc.capacityBytes > 0 ? (usedBytes / pvc.capacityBytes) * 100 : 0
                  return (
                    <TableRow key={pvc.name}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {pvc.type === 'shared' ? (
                            <Share2 className="size-4 text-blue-500 shrink-0" />
                          ) : (
                            <HardDrive className="size-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="font-mono text-xs">{pvc.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={pvc.type === 'shared' ? 'default' : 'secondary'} className="text-xs">
                          {pvc.type === 'shared' ? '공유' : '개인'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{pvc.capacity}</TableCell>
                      <TableCell className="text-sm">
                        {statsLoading ? (
                          <Skeleton className="h-4 w-14" />
                        ) : (
                          formatBytes(usedBytes)
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {statsLoading ? (
                          <Skeleton className="h-4 w-8" />
                        ) : (
                          stat?.fileCount?.toLocaleString() ?? 0
                        )}
                      </TableCell>
                      <TableCell className="w-[160px]">
                        {statsLoading ? (
                          <Skeleton className="h-2 w-full" />
                        ) : (
                          <div className="space-y-1">
                            <Progress
                              value={Math.min(usePct, 100)}
                              className="h-1.5"
                            />
                            <p className="text-[10px] text-muted-foreground">{usePct.toFixed(1)}%</p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={pvc.status === 'Bound' ? 'outline' : 'destructive'}
                          className="text-xs"
                        >
                          {pvc.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── 파일 브라우저 ────────────────────────────────────────────────────────────

function FileBrowser({ currentUser, isAdmin }: { currentUser: string; isAdmin: boolean }) {
  const [pvcs, setPvcs] = useState<PVC[]>([])
  // selectedBucket = 실제 S3 버킷명 (volumeName = pvc-{uuid}, 없으면 PVC 이름)
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [prefix, setPrefix] = useState('')
  const [folders, setFolders] = useState<BrowseFolder[]>([])
  const [files, setFiles] = useState<BrowseEntry[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [pvcLoading, setPvcLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<{ key: string; name: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [clipboard, setClipboard] = useState<{ bucket: string; key: string; name: string; isFolder: boolean } | null>(null)
  const [showMkdir, setShowMkdir] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [mkdirLoading, setMkdirLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initializedRef = useRef(false)

  // 버킷 목록 (PVC 목록 기반, 현재 유저 기준 필터)
  useEffect(() => {
    fetch('/api/storage/pvcs')
      .then(r => r.json())
      .then(data => {
        const all: PVC[] = data.pvcs ?? []
        const visible = isAdmin ? all : all.filter(p => p.type === 'shared' || p.user === currentUser)
        setPvcs(visible)
        if (visible.length > 0 && !initializedRef.current) {
          initializedRef.current = true
          // 내 개인 버킷을 먼저 선택, 없으면 첫 번째 공유 버킷
          const myBucket = visible.find(p => p.user === currentUser) ?? visible[0]
          setSelectedBucket(myBucket.volumeName || myBucket.name)
        }
      })
      .catch(() => {})
      .finally(() => setPvcLoading(false))
  }, [currentUser])

  // 파일 목록 조회
  const browse = useCallback(async (bucket: string, path: string) => {
    setBrowseLoading(true)
    try {
      const res = await fetch(`/api/storage/browse?bucket=${encodeURIComponent(bucket)}&prefix=${encodeURIComponent(path)}`)
      const data = await res.json()
      setFolders(data.folders ?? [])
      setFiles(data.files ?? [])
    } catch {
      setFolders([])
      setFiles([])
    } finally {
      setBrowseLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedBucket) browse(selectedBucket, prefix)
  }, [selectedBucket, prefix, browse])

  // 브레드크럼 경로 파싱
  const breadcrumbs = prefix
    ? prefix.split('/').filter(Boolean).map((part, i, arr) => ({
        label: part,
        prefix: arr.slice(0, i + 1).join('/') + '/',
      }))
    : []

  function navigateToPrefix(newPrefix: string) {
    setPrefix(newPrefix)
  }

  // bucketName = 실제 S3 버킷명 (volumeName 우선)
  function changeBucket(bucketName: string) {
    setSelectedBucket(bucketName)
    setPrefix('')
  }

  async function handleDownload(key: string, name: string) {
    const url = `/api/storage/download?bucket=${encodeURIComponent(selectedBucket!)}&key=${encodeURIComponent(key)}`
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
  }

  async function handleDelete() {
    if (!deleteTarget || !selectedBucket) return
    try {
      const res = await fetch(
        `/api/storage/delete?bucket=${encodeURIComponent(selectedBucket)}&key=${encodeURIComponent(deleteTarget.key)}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (data.success) {
        toast.success(`${deleteTarget.name} 삭제 완료`)
        browse(selectedBucket, prefix)
      } else {
        toast.error(data.error ?? '삭제 실패')
      }
    } catch {
      toast.error('삭제 실패')
    } finally {
      setDeleteTarget(null)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedBucket) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('bucket', selectedBucket)
      form.append('prefix', prefix)
      const res = await fetch('/api/storage/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (data.success) {
        toast.success(`${file.name} 업로드 완료`)
        browse(selectedBucket, prefix)
      } else {
        toast.error(data.error ?? '업로드 실패')
      }
    } catch {
      toast.error('업로드 실패')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleMkdir() {
    if (!selectedBucket || !newFolderName.trim()) return
    setMkdirLoading(true)
    try {
      const res = await fetch('/api/storage/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: selectedBucket, prefix, name: newFolderName.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`'${newFolderName.trim()}' 폴더 생성 완료`)
        setShowMkdir(false)
        setNewFolderName('')
        browse(selectedBucket, prefix)
      } else {
        toast.error(data.error ?? '폴더 생성 실패')
      }
    } catch {
      toast.error('폴더 생성 실패')
    } finally {
      setMkdirLoading(false)
    }
  }

  function handleCopyItem(key: string, name: string, isFolder: boolean) {
    if (!selectedBucket) return
    setClipboard({ bucket: selectedBucket, key, name, isFolder })
    toast.success(`'${name}' 복사됨 — 붙여넣을 위치로 이동 후 붙여넣기를 누르세요`)
  }

  async function handlePaste() {
    if (!clipboard || !selectedBucket) return
    const destName = clipboard.bucket === selectedBucket && (clipboard.key === prefix + clipboard.name || clipboard.key === prefix + clipboard.name + '/')
      ? `${clipboard.name}_copy`
      : clipboard.name
    try {
      const res = await fetch('/api/storage/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceBucket: clipboard.bucket,
          sourceKey: clipboard.key,
          destBucket: selectedBucket,
          destPrefix: prefix,
          name: destName,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`'${destName}' 붙여넣기 완료`)
        setClipboard(null)
        browse(selectedBucket, prefix)
      } else {
        toast.error(data.error ?? '붙여넣기 실패')
      }
    } catch {
      toast.error('붙여넣기 실패')
    }
  }

  // selectedBucket(volumeName)으로 PVC 표시명 역조회
  const currentPvc = pvcs.find(p => (p.volumeName || p.name) === selectedBucket)

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">
      {/* 좌측: 버킷 목록 */}
      <Card className="w-52 shrink-0 flex flex-col">
        <CardHeader className="pb-2 pt-4 px-3">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">스토리지 버킷</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-2">
          {pvcLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full mb-1" />
            ))
          ) : (
            <>
              {/* 공유 버킷 */}
              {pvcs.filter(p => p.type === 'shared').map(pvc => {
                const bucketName = pvc.volumeName || pvc.name
                return (
                  <button
                    key={pvc.name}
                    onClick={() => changeBucket(bucketName)}
                    className={`w-full flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium transition-colors text-left mb-0.5 ${
                      selectedBucket === bucketName
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <Share2 className="size-3.5 shrink-0" />
                    <span className="truncate">{pvc.name}</span>
                  </button>
                )
              })}

              {pvcs.filter(p => p.type === 'shared').length > 0 && pvcs.filter(p => p.type === 'personal').length > 0 && (
                <div className="my-2 border-t border-border/50">
                  <p className="px-2 pt-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">개인</p>
                </div>
              )}

              {/* 개인 버킷 */}
              {pvcs.filter(p => p.type === 'personal').map(pvc => {
                const bucketName = pvc.volumeName || pvc.name
                return (
                  <button
                    key={pvc.name}
                    onClick={() => changeBucket(bucketName)}
                    className={`w-full flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium transition-colors text-left mb-0.5 ${
                      selectedBucket === bucketName
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <HardDrive className="size-3.5 shrink-0" />
                    <span className="truncate">{pvc.user ?? pvc.name}</span>
                  </button>
                )
              })}
            </>
          )}
        </CardContent>
      </Card>

      {/* 우측: 파일 영역 */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* 헤더: 브레드크럼 + 업로드 */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto min-w-0">
            <button
              onClick={() => navigateToPrefix('')}
              className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0"
            >
              <Home className="size-3.5" />
              <span className="font-medium text-foreground">{currentPvc?.name ?? selectedBucket}</span>
            </button>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={crumb.prefix}>
                <ChevronRight className="size-3.5 shrink-0" />
                <button
                  onClick={() => navigateToPrefix(crumb.prefix)}
                  className={`hover:text-foreground transition-colors whitespace-nowrap ${
                    i === breadcrumbs.length - 1 ? 'text-foreground font-medium' : ''
                  }`}
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentPvc && (
              <Badge variant="outline" className="text-xs hidden sm:flex">
                {currentPvc.capacity} 할당
              </Badge>
            )}
            {clipboard && (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 gap-1.5 text-xs"
                onClick={handlePaste}
                disabled={!selectedBucket}
              >
                <ClipboardPaste className="size-3.5" />
                붙여넣기
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => { setShowMkdir(true); setNewFolderName('') }}
              disabled={!selectedBucket}
            >
              <FolderPlus className="size-3.5" />
              새 폴더
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !selectedBucket}
            >
              <Upload className="size-3.5" />
              {uploading ? '업로드 중...' : '업로드'}
            </Button>
          </div>
        </div>

        {/* 파일 테이블 */}
        <Card className="flex-1 overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead className="w-[100px]">크기</TableHead>
                  <TableHead className="w-[160px]">수정일</TableHead>
                  <TableHead className="w-[80px] text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* 상위 폴더로 이동 */}
                {prefix && (
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      const parts = prefix.split('/').filter(Boolean)
                      parts.pop()
                      navigateToPrefix(parts.length > 0 ? parts.join('/') + '/' : '')
                    }}
                  >
                    <TableCell><Folder className="size-4 text-yellow-500" /></TableCell>
                    <TableCell className="font-medium text-sm">..</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                  </TableRow>
                )}

                {browseLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="size-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell />
                    </TableRow>
                  ))
                ) : folders.length === 0 && files.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      <FolderOpen className="size-8 mx-auto mb-2 opacity-30" />
                      <p>비어 있는 폴더입니다</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {/* 폴더 */}
                    {folders.map(folder => (
                      <TableRow
                        key={folder.prefix}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigateToPrefix(folder.prefix)}
                      >
                        <TableCell>
                          <Folder className="size-4 text-yellow-500" />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{folder.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">—</TableCell>
                        <TableCell className="text-xs text-muted-foreground">—</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={e => { e.stopPropagation(); handleCopyItem(folder.prefix, folder.name, true) }}
                              title="복사"
                            >
                              <Copy className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* 파일 */}
                    {files.map(file => {
                      const Icon = getFileIcon(file.name)
                      return (
                        <TableRow key={file.key}>
                          <TableCell>
                            <Icon className="size-4 text-muted-foreground" />
                          </TableCell>
                          <TableCell className="text-sm">{file.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatBytes(file.size)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(file.lastModified)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => handleCopyItem(file.key, file.name, false)}
                                title="복사"
                              >
                                <Copy className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => handleDownload(file.key, file.name)}
                                title="다운로드"
                              >
                                <Download className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget({ key: file.key, name: file.name })}
                                title="삭제"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>파일 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{deleteTarget?.name}</span>을(를) 삭제하시겠습니까?
            이 작업은 되돌릴 수 없습니다.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 새 폴더 다이얼로그 */}
      <Dialog open={showMkdir} onOpenChange={open => { setShowMkdir(open); if (!open) setNewFolderName('') }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>새 폴더 만들기</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="folder-name" className="text-sm">폴더 이름</Label>
            <Input
              id="folder-name"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleMkdir() }}
              placeholder="새 폴더"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setShowMkdir(false)}>
              취소
            </Button>
            <Button size="sm" onClick={handleMkdir} disabled={mkdirLoading || !newFolderName.trim()}>
              {mkdirLoading ? '생성 중...' : '만들기'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function StoragePage() {
  const { user, isAdmin, loaded } = useCurrentUser()

  if (!loaded || !user) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Storage</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          SeaweedFS 기반 PVC 스토리지 현황 및 파일 브라우저
        </p>
      </div>

      {isAdmin ? (
        <Tabs defaultValue="usage">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="usage" className="gap-2">
              <Database className="size-3.5" />
              사용량 모니터링
            </TabsTrigger>
            <TabsTrigger value="browser" className="gap-2">
              <FolderOpen className="size-3.5" />
              파일 브라우저
            </TabsTrigger>
          </TabsList>
          <TabsContent value="usage" className="mt-4">
            <UsageMonitor currentUser={user} isAdmin={isAdmin} />
          </TabsContent>
          <TabsContent value="browser" className="mt-4">
            <FileBrowser currentUser={user} isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
      ) : (
        <FileBrowser currentUser={user} isAdmin={false} />
      )}
    </div>
  )
}
