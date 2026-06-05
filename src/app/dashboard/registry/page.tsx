'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback } from 'react'
import {
  Package,
  Tag,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Search,
  ChevronRight,
  Layers,
  AlertCircle,
  Box,
  Download,
  Upload,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

const REGISTRY_HOST = process.env.NEXT_PUBLIC_REGISTRY_HOST ?? '10.70.170.227'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface ManifestInfo {
  name: string
  tag: string
  digest: string
  totalSize: number
  totalSizeFormatted: string
  layerCount: number
  layers: { index: number; digest: string; size: number; sizeFormatted: string }[]
}

// ─── 복사 버튼 ────────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('클립보드에 복사됨')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="outline" size="sm" onClick={copy} className="h-7 gap-1.5 text-xs font-mono">
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {label}
    </Button>
  )
}

// ─── 이미지 상세 모달 ─────────────────────────────────────────────────────────

function ManifestModal({
  info,
  onClose,
  onDelete,
}: {
  info: ManifestInfo | null
  onClose: () => void
  onDelete: (digest: string) => void
}) {
  if (!info) return null
  const pullCmd = `docker pull ${REGISTRY_HOST}/${info.name}:${info.tag}`
  const pushCmd = `docker tag <image> ${REGISTRY_HOST}/${info.name}:${info.tag} && docker push ${REGISTRY_HOST}/${info.name}:${info.tag}`

  return (
    <Dialog open={!!info} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono">
            {info.name}:{info.tag}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 요약 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">전체 크기</p>
              <p className="text-sm font-bold mt-0.5">{info.totalSizeFormatted}</p>
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">레이어 수</p>
              <p className="text-sm font-bold mt-0.5">{info.layerCount}</p>
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Digest</p>
              <p className="text-[10px] font-mono mt-0.5 truncate">{info.digest.slice(7, 19)}…</p>
            </div>
          </div>

          {/* 명령어 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Download className="size-3.5 shrink-0 text-blue-500" />
                <code className="text-xs truncate">{pullCmd}</code>
              </div>
              <CopyButton text={pullCmd} label="Pull" />
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Upload className="size-3.5 shrink-0 text-green-500" />
                <code className="text-xs truncate">{`docker push ${REGISTRY_HOST}/${info.name}:${info.tag}`}</code>
              </div>
              <CopyButton text={pushCmd} label="Push" />
            </div>
          </div>

          {/* 레이어 */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Layers className="size-3.5" /> 레이어 ({info.layerCount})
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {info.layers.map(layer => (
                <div
                  key={layer.digest}
                  className="flex items-center justify-between rounded-sm bg-muted/40 px-3 py-1.5 text-xs"
                >
                  <span className="font-mono text-muted-foreground">
                    #{layer.index} {layer.digest.slice(7, 19)}…
                  </span>
                  <span className="text-muted-foreground">{layer.sizeFormatted}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 삭제 */}
          <div className="flex justify-end pt-1 border-t">
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                onDelete(info.digest)
                onClose()
              }}
            >
              <Trash2 className="size-3.5" />
              이 태그 삭제
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function RegistryPage() {
  const [repos, setRepos] = useState<string[]>([])
  const [repoLoading, setRepoLoading] = useState(true)
  const [repoSearch, setRepoSearch] = useState('')
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)

  const [tags, setTags] = useState<string[]>([])
  const [tagLoading, setTagLoading] = useState(false)

  const [manifest, setManifest] = useState<ManifestInfo | null>(null)
  const [manifestLoading, setManifestLoading] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)

  // 레포 목록 조회
  const fetchRepos = useCallback(async () => {
    setRepoLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/registry/catalog')
      const data = await res.json()
      if (data.error) setError(data.error)
      setRepos(data.repositories ?? [])
    } catch {
      setError('Registry 연결 실패')
    } finally {
      setRepoLoading(false)
    }
  }, [])

  useEffect(() => { fetchRepos() }, [fetchRepos])

  // 태그 목록 조회
  const fetchTags = useCallback(async (name: string) => {
    setTagLoading(true)
    setTags([])
    try {
      const res = await fetch(`/api/registry/tags?name=${encodeURIComponent(name)}`)
      const data = await res.json()
      setTags(data.tags ?? [])
    } catch {
      setTags([])
    } finally {
      setTagLoading(false)
    }
  }, [])

  function selectRepo(name: string) {
    setSelectedRepo(name)
    fetchTags(name)
  }

  // 매니페스트 조회
  async function openManifest(name: string, tag: string) {
    setManifestLoading(tag)
    try {
      const res = await fetch(`/api/registry/manifest?name=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`)
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      setManifest(data)
    } catch {
      toast.error('이미지 정보 조회 실패')
    } finally {
      setManifestLoading(null)
    }
  }

  // 태그 삭제
  async function deleteTag(name: string, digest: string, tag: string) {
    try {
      const res = await fetch(
        `/api/registry/delete?name=${encodeURIComponent(name)}&digest=${encodeURIComponent(digest)}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (data.success) {
        toast.success(`${name}:${tag} 삭제 완료`)
        fetchTags(name)
      } else {
        toast.error(data.error ?? '삭제 실패')
      }
    } catch {
      toast.error('삭제 실패')
    }
  }

  const filteredRepos = repos.filter(r =>
    r.toLowerCase().includes(repoSearch.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Container Registry</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {REGISTRY_HOST} — Docker 이미지 브라우저
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRepos} className="h-8 gap-1.5 text-xs">
          <RefreshCw className="size-3" />
          새로고침
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>Registry 연결 오류: {error}</span>
        </div>
      )}

      <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[500px]">
        {/* 좌측: 레포지토리 목록 */}
        <Card className="w-64 shrink-0 flex flex-col">
          <CardHeader className="pb-2 pt-4 px-3 space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Repositories
              </CardTitle>
              {!repoLoading && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {filteredRepos.length}
                </Badge>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="검색..."
                value={repoSearch}
                onChange={e => setRepoSearch(e.target.value)}
                className="pl-7 h-7 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-2">
            {repoLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full mb-1" />
              ))
            ) : filteredRepos.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                {repos.length === 0 ? '이미지 없음' : '검색 결과 없음'}
              </p>
            ) : (
              filteredRepos.map(repo => (
                <button
                  key={repo}
                  onClick={() => selectRepo(repo)}
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-2 text-xs font-medium transition-colors text-left mb-0.5 ${
                    selectedRepo === repo
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Package className="size-3.5 shrink-0" />
                  <span className="truncate">{repo}</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* 우측: 태그 목록 */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          {!selectedRepo ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Box className="size-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">레포지토리를 선택하세요</p>
              </div>
            </div>
          ) : (
            <>
              <CardHeader className="pb-3 pt-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold font-mono">{selectedRepo}</CardTitle>
                    {!tagLoading && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {tags.length} tags
                      </Badge>
                    )}
                  </div>
                  <CopyButton
                    text={`${REGISTRY_HOST}/${selectedRepo}`}
                    label={`${REGISTRY_HOST}/${selectedRepo}`}
                  />
                </div>
              </CardHeader>

              <div className="flex-1 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>태그</TableHead>
                      <TableHead className="text-right w-48">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tagLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="size-4" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : tags.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                          태그가 없습니다
                        </TableCell>
                      </TableRow>
                    ) : (
                      tags.map(tag => (
                        <TableRow
                          key={tag}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openManifest(selectedRepo, tag)}
                        >
                          <TableCell>
                            <Tag className="size-3.5 text-muted-foreground" />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{tag}</span>
                              {tag === 'latest' && (
                                <Badge className="text-[10px] h-4 px-1.5 bg-blue-500/15 text-blue-600 border-blue-500/30">
                                  latest
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={e => e.stopPropagation()}
                            >
                              {manifestLoading === tag ? (
                                <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1 text-xs"
                                  onClick={() => openManifest(selectedRepo, tag)}
                                >
                                  <ChevronRight className="size-3.5" />
                                  상세
                                </Button>
                              )}
                              <CopyButton
                                text={`docker pull ${REGISTRY_HOST}/${selectedRepo}:${tag}`}
                                label="Pull"
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* 이미지 상세 모달 */}
      <ManifestModal
        info={manifest}
        onClose={() => setManifest(null)}
        onDelete={(digest) => manifest && deleteTag(manifest.name, digest, manifest.tag)}
      />
    </div>
  )
}
