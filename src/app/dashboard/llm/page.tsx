'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  Trash2,
  Plus,
  Cpu,
  Server,
  Layers,
  Link2,
  AlertTriangle,
  Folder,
  CornerUpLeft,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface LLMDeployment {
  name: string
  namespace: string
  modelId: string
  status: 'Running' | 'Pending' | 'NotReady'
  replicas: number
  readyReplicas: number
  gpuCount: number
  endpoint: string | null
  isvcName: string | null
  isvcNamespace: string | null
  isvcUrl: string | null
  createdAt: string
}

interface DeployForm {
  name: string
  namespace: string
  modelId: string
  gpuCount: string
  tensorParallelSize: string
  maxModelLen: string
  dtype: string
  image: string
  replicas: string
}

const DEFAULT_FORM: DeployForm = {
  name: '',
  namespace: 'default',
  modelId: '',
  gpuCount: '1',
  tensorParallelSize: '',
  maxModelLen: '',
  dtype: 'auto',
  image: 'vllm/vllm-openai:latest',
  replicas: '1',
}

function StatusBadge({ status }: { status: LLMDeployment['status'] }) {
  if (status === 'Running') return (
    <Badge className="bg-green-500/10 text-green-600 border-green-500/20 gap-1">
      <CheckCircle2 className="size-3" /> Running
    </Badge>
  )
  if (status === 'Pending') return (
    <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 gap-1">
      <Clock className="size-3" /> Pending
    </Badge>
  )
  return (
    <Badge className="bg-red-500/10 text-red-600 border-red-500/20 gap-1">
      <XCircle className="size-3" /> Not Ready
    </Badge>
  )
}

export default function LLMPage() {
  const [deployments, setDeployments] = useState<LLMDeployment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [form, setForm] = useState<DeployForm>(DEFAULT_FORM)
  const [deploying, setDeploying] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<LLMDeployment | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [isPathSelectorOpen, setIsPathSelectorOpen] = useState(false)
  const [pathPrefix, setPathPrefix] = useState('')
  const [pathFolders, setPathFolders] = useState<any[]>([])
  const [loadingPath, setLoadingPath] = useState(false)

  const fetchFolders = async (prefix: string) => {
    setLoadingPath(true)
    try {
      const res = await fetch(`/api/storage/browse?bucket=shared-sllm&prefix=${encodeURIComponent(prefix)}`)
      const data = await res.json()
      setPathFolders(data.folders || [])
    } catch {
      setPathFolders([])
    } finally {
      setLoadingPath(false)
    }
  }

  useEffect(() => {
    if (isPathSelectorOpen) {
      fetchFolders(pathPrefix)
    }
  }, [isPathSelectorOpen, pathPrefix])

  const fetchDeployments = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/llm/deployments')
      const data = await res.json()
      if (data.error && !data.deployments?.length) {
        setError(data.error)
      }
      setDeployments(data.deployments || [])
    } catch {
      setError('API 호출 실패')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchDeployments() }, [fetchDeployments])

  const running = deployments.filter(d => d.status === 'Running').length
  const pending = deployments.filter(d => d.status === 'Pending').length
  const totalGpus = deployments.reduce((sum, d) => sum + d.gpuCount, 0)
  const linked = deployments.filter(d => d.isvcName).length

  const handleDeploy = async () => {
    setDeployError(null)
    setDeploySuccess(null)
    setDeploying(true)
    try {
      const res = await fetch('/api/llm/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          namespace: form.namespace,
          modelId: form.modelId,
          gpuCount: parseInt(form.gpuCount),
          tensorParallelSize: form.tensorParallelSize ? parseInt(form.tensorParallelSize) : undefined,
          maxModelLen: form.maxModelLen ? parseInt(form.maxModelLen) : undefined,
          dtype: form.dtype,
          image: form.image,
          replicas: parseInt(form.replicas),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeployError(data.error || '배포 실패')
      } else {
        setDeploySuccess(`${data.deploymentName} 배포 시작됨 (namespace: ${data.namespace})`)
        setForm(DEFAULT_FORM)
        setTimeout(() => fetchDeployments(true), 2000)
      }
    } catch (e: any) {
      setDeployError(e.message)
    } finally {
      setDeploying(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch('/api/llm/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deleteTarget.name, namespace: deleteTarget.namespace }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || '삭제 실패')
      } else {
        setDeleteTarget(null)
        fetchDeployments(true)
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex-1 space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="size-6" />
            Private LLM
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">vLLM 기반 사설 LLM 배포 및 현황 관리</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchDeployments(true)} disabled={refreshing}>
          <RefreshCw className={`size-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Server className="size-3.5" /> 전체 배포</div>
            <div className="text-2xl font-bold">{loading ? <Skeleton className="h-7 w-8" /> : deployments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600 text-xs mb-1"><CheckCircle2 className="size-3.5" /> Running</div>
            <div className="text-2xl font-bold">{loading ? <Skeleton className="h-7 w-8" /> : running}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Cpu className="size-3.5" /> GPU 합계</div>
            <div className="text-2xl font-bold">{loading ? <Skeleton className="h-7 w-8" /> : totalGpus}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 text-xs mb-1"><Link2 className="size-3.5" /> Serving 연결</div>
            <div className="text-2xl font-bold">{loading ? <Skeleton className="h-7 w-8" /> : `${linked} / ${deployments.length}`}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list" className="gap-1.5">
            <Layers className="size-3.5" /> 배포 현황
          </TabsTrigger>
          <TabsTrigger value="deploy" className="gap-1.5">
            <Plus className="size-3.5" /> 신규 배포
          </TabsTrigger>
        </TabsList>

        {/* ─── 배포 현황 탭 ─── */}
        <TabsContent value="list" className="mt-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 text-destructive px-4 py-3 text-sm mb-4">
              <AlertTriangle className="size-4 shrink-0" />
              K8s API 오류: {error}
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">vLLM 인스턴스 목록</CardTitle>
              <CardDescription>label <code>app=vllm</code> 로 필터링된 Deployment 목록</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : deployments.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
                  <Bot className="size-10 opacity-30" />
                  <p className="text-sm">배포된 vLLM 인스턴스가 없습니다.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>모델 ID</TableHead>
                      <TableHead>네임스페이스</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-center">GPU</TableHead>
                      <TableHead className="text-center">Replica</TableHead>
                      <TableHead>Serving 연결</TableHead>
                      <TableHead>엔드포인트</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deployments.map(dep => (
                      <TableRow key={dep.name}>
                        <TableCell className="font-mono text-sm font-medium">{dep.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={dep.modelId}>
                          {dep.modelId}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{dep.namespace}</Badge>
                        </TableCell>
                        <TableCell><StatusBadge status={dep.status} /></TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="gap-1">
                            <Cpu className="size-3" />{dep.gpuCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {dep.readyReplicas} / {dep.replicas}
                        </TableCell>
                        <TableCell>
                          {dep.isvcName ? (
                            <Link
                              href="/dashboard/serving"
                              className="flex items-center gap-1 text-blue-600 hover:underline text-sm"
                            >
                              <Link2 className="size-3.5" />
                              {dep.isvcName}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {dep.isvcUrl || dep.endpoint ? (
                            <a
                              href={dep.isvcUrl || dep.endpoint!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="size-3.5" />
                              {dep.isvcUrl
                                ? dep.isvcUrl.replace(/^https?:\/\//, '').slice(0, 30)
                                : dep.endpoint!.replace(/^https?:\/\//, '').slice(0, 30)}
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTarget(dep)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {deployments.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Serving 연결은 동일한 이름의 KServe InferenceService가 있을 때 자동 매핑됩니다.{' '}
                  <Link href="/dashboard/serving" className="underline hover:text-foreground">Service Operation →</Link>
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── 신규 배포 탭 ─── */}
        <TabsContent value="deploy" className="mt-4">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">vLLM 모델 배포</CardTitle>
              <CardDescription>
                Kubernetes Deployment + ClusterIP Service를 생성합니다. GPU 노드에 자동 스케줄됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {deployError && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
                  <AlertTriangle className="size-4 shrink-0" />
                  {deployError}
                </div>
              )}
              {deploySuccess && (
                <div className="flex items-center gap-2 rounded-md bg-green-500/10 text-green-600 px-3 py-2 text-sm">
                  <CheckCircle2 className="size-4 shrink-0" />
                  {deploySuccess}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">배포 이름 <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    placeholder="llama3-8b"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">vllm-{form.name || '<이름>'} 으로 생성됩니다</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="namespace">네임스페이스</Label>
                  <Input
                    id="namespace"
                    value={form.namespace}
                    onChange={e => setForm(f => ({ ...f, namespace: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="modelId">모델 ID <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <Input
                    id="modelId"
                    placeholder="meta-llama/Meta-Llama-3-8B-Instruct"
                    value={form.modelId}
                    onChange={e => setForm(f => ({ ...f, modelId: e.target.value }))}
                    className="flex-1"
                  />
                  <Button variant="outline" type="button" onClick={() => {
                    setPathPrefix('')
                    setIsPathSelectorOpen(true)
                  }}>
                    <Folder className="size-4 mr-2" />
                    경로 찾기
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">HuggingFace 모델 ID 또는 로컬 경로 (PVC 마운트 시)</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="gpuCount">GPU 수</Label>
                  <Select value={form.gpuCount} onValueChange={v => setForm(f => ({ ...f, gpuCount: v }))}>
                    <SelectTrigger id="gpuCount">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['1','2','4','8'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dtype">dtype</Label>
                  <Select value={form.dtype} onValueChange={v => setForm(f => ({ ...f, dtype: v }))}>
                    <SelectTrigger id="dtype">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['auto','float16','bfloat16','float32'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="replicas">Replica</Label>
                  <Select value={form.replicas} onValueChange={v => setForm(f => ({ ...f, replicas: v }))}>
                    <SelectTrigger id="replicas">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['1','2','3'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="maxModelLen">max-model-len <span className="text-muted-foreground text-xs">(선택)</span></Label>
                  <Input
                    id="maxModelLen"
                    type="number"
                    placeholder="4096"
                    value={form.maxModelLen}
                    onChange={e => setForm(f => ({ ...f, maxModelLen: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="image">컨테이너 이미지</Label>
                  <Input
                    id="image"
                    value={form.image}
                    onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                  />
                </div>
              </div>

              <Button
                onClick={handleDeploy}
                disabled={deploying || !form.name || !form.modelId}
                className="w-full"
              >
                {deploying ? (
                  <><RefreshCw className="size-4 mr-2 animate-spin" />배포 중...</>
                ) : (
                  <><Plus className="size-4 mr-2" />배포 시작</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>배포 삭제</DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.name}</strong> (namespace: {deleteTarget?.namespace}) 의
              Deployment와 Service를 삭제합니다. 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>취소</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <RefreshCw className="size-4 mr-2 animate-spin" /> : <Trash2 className="size-4 mr-2" />}
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 경로 선택 다이얼로그 */}
      <Dialog open={isPathSelectorOpen} onOpenChange={setIsPathSelectorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>로컬 모델 경로 선택</DialogTitle>
            <DialogDescription>
              shared-sllm 스토리지에 저장된 모델 폴더를 선택하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="border rounded-md overflow-hidden flex flex-col h-[300px]">
            <div className="bg-muted p-2 flex items-center gap-2 text-sm font-mono border-b">
              <Button 
                variant="ghost" 
                size="icon" 
                className="size-6 h-6 w-6" 
                disabled={!pathPrefix}
                onClick={() => {
                  const parts = pathPrefix.split('/').filter(Boolean)
                  parts.pop()
                  setPathPrefix(parts.length ? parts.join('/') + '/' : '')
                }}
              >
                <CornerUpLeft className="size-4" />
              </Button>
              <span className="truncate">/mnt/models/{pathPrefix}</span>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1">
              {loadingPath ? (
                <div className="p-4 text-center text-sm text-muted-foreground">불러오는 중...</div>
              ) : pathFolders.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">하위 폴더가 없습니다.</div>
              ) : (
                pathFolders.map(f => (
                  <Button 
                    key={f.prefix} 
                    variant="ghost" 
                    className="w-full justify-start text-sm h-8 px-2"
                    onClick={() => setPathPrefix(f.prefix)}
                  >
                    <Folder className="size-4 mr-2 text-blue-500" />
                    {f.name}
                  </Button>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPathSelectorOpen(false)}>취소</Button>
            <Button onClick={() => {
              setForm(f => ({ ...f, modelId: `/mnt/models/${pathPrefix.replace(/\/$/, '')}` }))
              setIsPathSelectorOpen(false)
            }}>
              이 폴더 선택
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
