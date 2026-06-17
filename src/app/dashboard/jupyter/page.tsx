'use client'

import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, Plus, Trash2, RefreshCw, BookOpen, Loader2, KeyRound, PowerOff, Play, WifiOff } from 'lucide-react'
import { useCurrentUser } from '@/hooks/use-current-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

interface JupyterImage {
  label: string
  value: string
}

interface Server {
  name: string
  ready: boolean
  pending: string | null
  url: string
}

interface OfflineServer {
  name: string
  nfsType: string
}

const SERVER_NAME_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

function StatusBadge({ ready, pending }: { ready: boolean; pending: string | null }) {
  if (pending === 'spawn') return <Badge className="bg-yellow-500 text-white">Starting</Badge>
  if (pending === 'stop') return <Badge className="bg-orange-500 text-white">Stopping</Badge>
  if (ready) return <Badge className="bg-green-500 text-white">Running</Badge>
  return <Badge variant="secondary">Stopped</Badge>
}

export default function JupyterPage() {
  const { user, loaded } = useCurrentUser()
  const [servers, setServers] = useState<Server[]>([])
  const [offlineServers, setOfflineServers] = useState<OfflineServer[]>([])
  const [openingServer, setOpeningServer] = useState<string | null>(null)
  const [reauthing, setReauthing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newImage, setNewImage] = useState('')
  const [nfsType, setNfsType] = useState<'shared-sllm' | 'ds-nfs'>('shared-sllm')
  const [gpuType, setGpuType] = useState<'none' | 'standard' | 'high'>('none')
  const [nameError, setNameError] = useState('')
  const [creating, setCreating] = useState(false)
  const [offingName, setOffingName] = useState<string | null>(null)
  const [startingName, setStartingName] = useState<string | null>(null)
  const [jupyterImages, setJupyterImages] = useState<JupyterImage[]>([])
  const [imageMode, setImageMode] = useState<'select' | 'manual'>('select')

  // 삭제 확인 다이얼로그
  const [confirmDelete, setConfirmDelete] = useState<{
    name: string
    isOffline: boolean
    nfsType?: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchServers = useCallback(async (u: string) => {
    setLoading(true)
    try {
      const [serverRes, offlineRes] = await Promise.all([
        fetch(`/api/jupyter/servers?username=${encodeURIComponent(u)}`),
        fetch(`/api/jupyter/offline-servers?username=${encodeURIComponent(u)}`),
      ])
      const serverData = await serverRes.json()
      const offlineData = await offlineRes.json()
      setServers(serverData.servers ?? [])
      setOfflineServers(offlineData.servers ?? [])
    } catch {
      toast.error('서버 목록 조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!loaded || !user) return
    fetchServers(user)
  }, [loaded, user, fetchServers])

  useEffect(() => {
    if (!user) return
    const hasPending = servers.some(s => s.pending !== null)
    if (!hasPending) return
    const timer = setInterval(() => fetchServers(user), 3000)
    return () => clearInterval(timer)
  }, [servers, user, fetchServers])

  function handleNameChange(value: string) {
    setNewName(value)
    if (value && !SERVER_NAME_REGEX.test(value)) {
      setNameError('영소문자, 숫자, 하이픈만 사용 가능하며 영소문자/숫자로 시작·끝나야 합니다')
    } else {
      setNameError('')
    }
  }

  useEffect(() => {
    if (!dialogOpen) return
    fetch('/api/registry/jupyter-images')
      .then(r => r.json())
      .then(data => setJupyterImages(data.images ?? []))
      .catch(() => setJupyterImages([]))
  }, [dialogOpen])

  function handleDialogClose() {
    setDialogOpen(false)
    setNewName('')
    setNewImage('')
    setNfsType('shared-sllm')
    setGpuType('none')
    setNameError('')
    setImageMode('select')
  }

  async function handleCreate() {
    if (!newName.trim() || !user) return
    if (!SERVER_NAME_REGEX.test(newName.trim())) {
      setNameError('영소문자, 숫자, 하이픈만 사용 가능하며 영소문자/숫자로 시작·끝나야 합니다')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/jupyter/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user,
          name: newName.trim(),
          image: newImage.trim() || undefined,
          nfs_type: nfsType,
          gpu_type: gpuType === 'none' ? undefined : gpuType,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`${newName} 생성 중...`)
        handleDialogClose()
        fetchServers(user)
      } else {
        toast.error(data.error ?? '생성 실패')
      }
    } catch {
      toast.error('생성 실패')
    } finally {
      setCreating(false)
    }
  }

  async function handleOpen(server: Server) {
    if (!user) return
    setOpeningServer(server.name)
    try {
      const res = await fetch('/api/jupyter/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user }),
      })
      const data = await res.json()
      const url = data.token ? `${server.url}?token=${data.token}` : server.url
      window.open(url, '_blank')
    } catch {
      window.open(server.url, '_blank')
    } finally {
      setOpeningServer(null)
    }
  }

  async function handleReauth(server: Server) {
    if (!user) return
    setReauthing(server.name)
    try {
      const res = await fetch('/api/jupyter/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user }),
      })
      const data = await res.json()
      const url = data.token ? `${server.url}?token=${data.token}` : server.url
      window.open(url, '_blank')
    } catch {
      window.open(server.url, '_blank')
    } finally {
      setReauthing(null)
    }
  }

  async function handleOff(name: string) {
    if (!user) return
    setOffingName(name)
    try {
      const res = await fetch(
        `/api/jupyter/servers/${encodeURIComponent(name)}?username=${encodeURIComponent(user)}&action=off`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (data.success) {
        toast.success(`${name} 종료됨 (데이터 보존)`)
        fetchServers(user)
      } else {
        toast.error(data.error ?? '종료 실패')
      }
    } catch {
      toast.error('종료 실패')
    } finally {
      setOffingName(null)
    }
  }

  async function handleDeleteConfirmed() {
    if (!confirmDelete || !user) return
    setDeleting(true)
    try {
      if (confirmDelete.isOffline) {
        // 오프라인 서버: NFS 폴더만 삭제
        const params = new URLSearchParams({ username: user, name: confirmDelete.name })
        if (confirmDelete.nfsType) params.set('nfs_type', confirmDelete.nfsType)
        const res = await fetch(`/api/jupyter/offline-servers?${params}`, { method: 'DELETE' })
        const data = await res.json()
        if (data.success) {
          toast.success(`${confirmDelete.name} 영구 삭제됨`)
          fetchServers(user)
        } else {
          toast.error(data.error ?? '삭제 실패')
        }
      } else {
        // 실행 중 서버: 파드 종료 + NFS 폴더 삭제
        const res = await fetch(
          `/api/jupyter/servers/${encodeURIComponent(confirmDelete.name)}?username=${encodeURIComponent(user)}&action=delete`,
          { method: 'DELETE' }
        )
        const data = await res.json()
        if (data.success) {
          toast.success(`${confirmDelete.name} 영구 삭제됨`)
          fetchServers(user)
        } else {
          toast.error(data.error ?? '삭제 실패')
        }
      }
    } catch {
      toast.error('삭제 실패')
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
    }
  }

  async function handleStartOffline(server: OfflineServer) {
    if (!user) return
    setStartingName(`${server.name}:${server.nfsType}`)
    try {
      const res = await fetch('/api/jupyter/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user,
          name: server.name,
          nfs_type: server.nfsType,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`${server.name} 재시작 중...`)
        fetchServers(user)
      } else {
        toast.error(data.error ?? '재시작 실패')
      }
    } catch {
      toast.error('재시작 실패')
    } finally {
      setStartingName(null)
    }
  }

  if (!loaded || !user) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Jupyter Notebooks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">개인 개발환경 생성 및 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => fetchServers(user)}>
            <RefreshCw className="size-3.5" />
            새로고침
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setDialogOpen(true)}>
            <Plus className="size-3.5" />
            새 서버
          </Button>
        </div>
      </div>

      {/* 서버 생성 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={open => !open && handleDialogClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>새 노트북 서버 생성</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">서버 이름</label>
              <Input
                placeholder="예: pytorch-env"
                value={newName}
                onChange={e => handleNameChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="h-9"
                autoFocus
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              <p className="text-xs text-muted-foreground">영소문자, 숫자, 하이픈만 사용 가능 (예: my-env, env01)</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">이미지 <span className="text-muted-foreground font-normal">(선택)</span></label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => {
                    setImageMode(m => m === 'select' ? 'manual' : 'select')
                    setNewImage('')
                  }}
                >
                  {imageMode === 'select' ? '직접 입력' : '레지스트리에서 선택'}
                </button>
              </div>
              {imageMode === 'select' ? (
                <Select
                  value={newImage || '__default__'}
                  onValueChange={v => setNewImage(v === '__default__' ? '' : v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={jupyterImages.length === 0 ? '등록된 Jupyter 이미지 없음' : '이미지 선택...'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">기본 이미지 사용</SelectItem>
                    {jupyterImages.map(img => (
                      <SelectItem key={img.value} value={img.value}>
                        <span className="font-mono text-xs">{img.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="registry/image:tag"
                  value={newImage}
                  onChange={e => setNewImage(e.target.value)}
                  className="h-9 font-mono text-sm"
                />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">스토리지</label>
              <div className="rounded-md border p-3 space-y-2">
                {([
                  { value: 'shared-sllm', label: 'shared-sllm', desc: '/ifs/data/nfs/dev/sllm' },
                  { value: 'ds-nfs', label: 'DS NFS', desc: '/ifs/data/nfs/DS' },
                ] as const).map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="nfs-type"
                      value={opt.value}
                      checked={nfsType === opt.value}
                      onChange={() => setNfsType(opt.value)}
                      className="accent-primary"
                    />
                    <span className="text-sm">
                      {opt.label} — <span className="font-mono text-xs text-muted-foreground">{opt.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">/home/jovyan/work 에 마운트됩니다.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">GPU <span className="text-muted-foreground font-normal">(선택)</span></label>
              <Select value={gpuType} onValueChange={v => setGpuType(v as 'none' | 'standard' | 'high')}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">사용 안 함</SelectItem>
                  <SelectItem value="standard" disabled>Standard — ds-dev-005 (준비중, 자원 부족)</SelectItem>
                  <SelectItem value="high">High — H200 (op-l-h200-gpu-004)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">GPU 선택 시 해당 GPU 노드에만 스케줄링되며, CUDA가 포함된 이미지로 자동 전환됩니다. 자원이 부족하면 Pending 상태로 대기합니다.</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={handleDialogClose}>취소</Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newName.trim() || !!nameError || creating}
              >
                {creating ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Plus className="size-3.5 mr-1.5" />}
                생성
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!confirmDelete} onOpenChange={open => !open && !deleting && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>서버 영구 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">{confirmDelete?.name}</span> 서버를 삭제합니다.
          </p>
          <p className="text-sm text-destructive font-medium">
            ⚠️ 저장된 모든 데이터가 영구 삭제됩니다. 계속하시겠습니까?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              취소
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteConfirmed} disabled={deleting}>
              {deleting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Trash2 className="size-3.5 mr-1.5" />}
              영구 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 실행 중 서버 목록 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="size-4" />
            노트북 서버 목록
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>서버 이름</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : servers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    실행 중인 서버가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                servers.map(server => (
                  <TableRow
                    key={server.name}
                    className={server.ready ? 'cursor-pointer hover:bg-muted/50' : ''}
                    onClick={() => server.ready && handleOpen(server)}
                  >
                    <TableCell className="font-mono text-sm">{server.name}</TableCell>
                    <TableCell><StatusBadge ready={server.ready} pending={server.pending} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {server.ready && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={e => { e.stopPropagation(); handleOpen(server) }}
                              disabled={openingServer === server.name}
                              title="열기"
                            >
                              {openingServer === server.name
                                ? <Loader2 className="size-3.5 animate-spin" />
                                : <ExternalLink className="size-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground"
                              onClick={e => { e.stopPropagation(); handleReauth(server) }}
                              disabled={reauthing === server.name}
                              title="토큰 재인증"
                            >
                              {reauthing === server.name
                                ? <Loader2 className="size-3.5 animate-spin" />
                                : <KeyRound className="size-3.5" />}
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          onClick={e => { e.stopPropagation(); handleOff(server.name) }}
                          disabled={offingName === server.name}
                          title="Off (데이터 보존)"
                        >
                          {offingName === server.name
                            ? <Loader2 className="size-3.5 animate-spin" />
                            : <PowerOff className="size-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={e => { e.stopPropagation(); setConfirmDelete({ name: server.name, isOffline: false }) }}
                          title="완전 삭제 (데이터 포함)"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 오프라인 서버 목록 */}
      {!loading && offlineServers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <WifiOff className="size-4 text-muted-foreground" />
              오프라인 서버 (데이터 보존 중)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>서버 이름</TableHead>
                  <TableHead>스토리지</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offlineServers.map(server => {
                  const key = `${server.name}:${server.nfsType}`
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-mono text-sm">{server.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {server.nfsType === 'ds-nfs' ? 'DS NFS' : 'shared-sllm'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleStartOffline(server)}
                            disabled={startingName === key}
                            title="재시작"
                          >
                            {startingName === key
                              ? <Loader2 className="size-3.5 animate-spin" />
                              : <Play className="size-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            onClick={() => setConfirmDelete({ name: server.name, isOffline: true, nfsType: server.nfsType })}
                            title="완전 삭제"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
