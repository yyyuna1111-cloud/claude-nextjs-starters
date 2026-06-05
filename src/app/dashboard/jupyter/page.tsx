'use client'

import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, Plus, Trash2, RefreshCw, BookOpen, Loader2 } from 'lucide-react'
import { useCurrentUser } from '@/hooks/use-current-user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

interface Server {
  name: string
  ready: boolean
  pending: string | null
  url: string
}

function StatusBadge({ ready, pending }: { ready: boolean; pending: string | null }) {
  if (pending === 'spawn') return <Badge className="bg-yellow-500 text-white">Starting</Badge>
  if (pending === 'stop') return <Badge className="bg-orange-500 text-white">Stopping</Badge>
  if (ready) return <Badge className="bg-green-500 text-white">Running</Badge>
  return <Badge variant="secondary">Stopped</Badge>
}

export default function JupyterPage() {
  const { user, loaded } = useCurrentUser()
  const [servers, setServers] = useState<Server[]>([])
  const [openingServer, setOpeningServer] = useState<string | null>(null)
  const [pendingOpenUrl, setPendingOpenUrl] = useState<string | null>(null)
  const [hasPVC, setHasPVC] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newImage, setNewImage] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingName, setDeletingName] = useState<string | null>(null)

  const fetchServers = useCallback(async (u: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/jupyter/servers?username=${encodeURIComponent(u)}`)
      const data = await res.json()
      setServers(data.servers ?? [])
    } catch {
      toast.error('서버 목록 조회 실패')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!loaded || !user) return
    fetch('/api/storage/pvcs')
      .then(r => r.json())
      .then(data => {
        const pvcs: { name: string }[] = data.pvcs ?? []
        setHasPVC(pvcs.some(p => p.name === `personal-${user}`))
      })
      .catch(() => setHasPVC(false))
    fetchServers(user)
  }, [loaded, user, fetchServers])

  // pending 상태 서버 있으면 3초마다 자동 폴링
  useEffect(() => {
    if (!user) return
    const hasPending = servers.some(s => s.pending !== null)
    if (!hasPending) return
    const timer = setInterval(() => fetchServers(user), 3000)
    return () => clearInterval(timer)
  }, [servers, user, fetchServers])

  async function handleCreate() {
    if (!newName.trim() || !user) return
    setCreating(true)
    try {
      const res = await fetch('/api/jupyter/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, name: newName.trim(), image: newImage.trim() || undefined }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`${newName} 생성 중...`)
        setNewName('')
        setNewImage('')
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
      setPendingOpenUrl(url)  // logout iframe onLoad 후 이 URL 열기
    } catch {
      window.open(server.url, '_blank')
      setOpeningServer(null)
    }
  }

  async function handleDelete(name: string) {
    if (!user) return
    setDeletingName(name)
    try {
      const res = await fetch(`/api/jupyter/servers/${encodeURIComponent(name)}?username=${encodeURIComponent(user)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`${name} 종료됨`)
        fetchServers(user)
      } else {
        toast.error(data.error ?? '삭제 실패')
      }
    } catch {
      toast.error('삭제 실패')
    } finally {
      setDeletingName(null)
    }
  }

  if (!loaded || !user) return null

  if (hasPVC === false) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-center">
      <BookOpen className="size-12 text-muted-foreground/30" />
      <p className="text-lg font-semibold">Jupyter 노트북을 이용할 수 없습니다</p>
      <p className="text-sm text-muted-foreground">
        <span className="font-mono font-medium">personal-{user}</span> 스토리지가 할당되지 않았습니다.<br />
        관리자에게 문의하세요.
      </p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Jupyter Notebooks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">개인 개발환경 생성 및 관리</p>
        </div>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => fetchServers(user)}>
          <RefreshCw className="size-3.5" />
          새로고침
        </Button>
      </div>

      {/* JupyterHub 세션 로그아웃 후 노트북 열기 */}
      {pendingOpenUrl && (
        <iframe
          src={`${process.env.NEXT_PUBLIC_JUPYTERHUB_URL ?? 'http://localhost:30900'}/hub/logout`}
          onLoad={() => {
            window.open(pendingOpenUrl, '_blank')
            setPendingOpenUrl(null)
            setOpeningServer(null)
          }}
          width="1" height="1"
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
        />
      )}

      {/* 생성 폼 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">새 노트북 서버 생성</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="서버 이름 (예: pytorch-env)"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="h-8 text-sm max-w-xs"
            />
            <Input
              placeholder="이미지 (기본값 사용 시 비워두기)"
              value={newImage}
              onChange={e => setNewImage(e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <Button size="sm" className="h-8 gap-1.5 shrink-0" onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              생성
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 서버 목록 */}
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
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={e => { e.stopPropagation(); handleDelete(server.name) }}
                          disabled={deletingName === server.name}
                          title="삭제"
                        >
                          {deletingName === server.name
                            ? <Loader2 className="size-3.5 animate-spin" />
                            : <Trash2 className="size-3.5" />}
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
    </div>
  )
}
