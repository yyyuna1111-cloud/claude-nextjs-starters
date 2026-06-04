'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Server,
  Box,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  Activity,
  Copy
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
import { ResourceTree, type ArgoNode } from '@/components/dashboard/resource-tree'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface Pod {
  name: string
  status: string
  node: string
  podIp: string
  restarts: number
  age: string
}

export default function ISVCDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const namespace = searchParams.get('ns') || 'default'

  const [isvcData, setIsvcData] = useState<any>(null)
  const [pods, setPods] = useState<Pod[]>([])
  const [engineInfo, setEngineInfo] = useState<{ name: string; image: string }>({ name: 'Detecting...', image: '...' })
  const [errorMetrics, setErrorMetrics] = useState<{ error413: any[], error429: any[], error5xx: any[] }>({ error413: [], error429: [], error5xx: [] })
  const [resourceMetrics, setResourceMetrics] = useState<{ cpu: any[], memory: any[], gpu: any[], gpuMem: any[] }>({ cpu: [], memory: [], gpu: [], gpuMem: [] })
  const [trafficMetrics, setTrafficMetrics] = useState<{ rps: any[], latency: any[], queue: any[] }>({ rps: [], latency: [], queue: [] })
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeResourceTab, setActiveResourceTab] = useState<'cpu' | 'memory' | 'gpu' | 'gpu_mem'>('cpu')
  const [treeNodes, setTreeNodes] = useState<ArgoNode[]>([])

  const fetchDetailData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/k8s/isvcs/${id}?ns=${namespace}`)
      if (!res.ok) throw new Error('API Error')
      const data = await res.json()
      
      setIsvcData(data.isvc)
      setPods(data.pods)
      setEngineInfo({
        name: data.engine,
        image: data.mainImage
      })
      setErrorMetrics(data.errorMetrics || { error413: [], error429: [], error5xx: [] })
      setResourceMetrics(data.resourceMetrics || { cpu: [], memory: [], gpu: [], gpuMem: [] })
      setTrafficMetrics(data.trafficMetrics || { rps: [], latency: [], queue: [] })

      // 4. 배포 구조도 더미 데이터
      setTreeNodes([
        { uid: 'isvc-001', name: id, kind: 'InferenceService', group: 'serving.kserve.io', version: 'v1beta1', health: { status: 'Healthy' } },
        { uid: 'pred-001', name: `${id}-predictor`, kind: 'Predictor', group: 'serving.kserve.io', version: 'v1beta1', health: { status: 'Healthy' }, parentRefs: [{ uid: 'isvc-001', kind: 'InferenceService', name: id }] },
        { uid: 'svc-001', name: `${id}-predictor-default`, kind: 'Service', version: 'v1', health: { status: 'Healthy' }, parentRefs: [{ uid: 'pred-001', kind: 'Predictor', name: `${id}-predictor` }] },
        { uid: 'deploy-001', name: `${id}-predictor-default-00001-deployment`, kind: 'Deployment', group: 'apps', version: 'v1', health: { status: 'Healthy' }, parentRefs: [{ uid: 'svc-001', kind: 'Service', name: `${id}-predictor-default` }] },
        { uid: 'rs-001', name: `${id}-predictor-default-00001-7f8b9`, kind: 'ReplicaSet', group: 'apps', version: 'v1', health: { status: 'Healthy' }, parentRefs: [{ uid: 'deploy-001', kind: 'Deployment', name: `${id}-predictor-default-00001-deployment` }] },
        { uid: 'pod-001', name: `${id}-predictor-default-00001-deployment-7f8b9-abcd`, kind: 'Pod', version: 'v1', health: { status: 'Healthy' }, parentRefs: [{ uid: 'rs-001', kind: 'ReplicaSet', name: `${id}-predictor-default-00001-7f8b9` }] },
      ])

      setLoading(false)
    } catch (err) {
      console.error('[ISVCDetail] Fetch Error:', err)
      setError('서비스 상세 정보를 가져오는데 실패했습니다.')
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetailData()
  }, [id, namespace])

  const getAge = (createdAt: string) => {
    const created = new Date(createdAt)
    const diff = Date.now() - created.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    if (days > 0) return `${days}d ${hours}h`
    return `${hours}h`
  }

  const podColors = ['#3b82f6', '#10b881', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']

  return (
    <div className="space-y-6 pb-10">
      {/* 상단 네비게이션 및 헤더 */}
      <div className="flex flex-col gap-4">
        <Link href="/dashboard/serving" className="text-muted-foreground hover:text-foreground flex items-center text-sm transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> 목록으로 돌아가기
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{id}</h1>
              <Badge variant="outline" className="text-xs font-normal">{namespace}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">InferenceService 상세 정보 및 소속 Pod 현황</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchDetailData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> 새로고침
          </Button>
        </div>
      </div>

      {/* 요약 정보 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="py-4">
            <CardTitle className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">서빙 엔진</CardTitle>
            <div className="mt-1 flex items-center gap-1.5 text-xl font-bold text-blue-600">
              <Activity className="h-5 w-5" /> {loading ? '...' : engineInfo.name}
            </div>
          </CardHeader>
        </Card>
        <Card className="md:col-span-2 border-l-4 border-l-slate-400">
          <CardHeader className="py-4">
            <CardTitle className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Container Image</CardTitle>
            <div className="mt-1 flex items-center gap-2 font-mono text-xs font-medium overflow-hidden">
              <Box className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="truncate text-slate-600" title={engineInfo.image}>{loading ? '...' : engineInfo.image}</span>
            </div>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="py-4">
            <CardTitle className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">가동 중 / 총 Pod</CardTitle>
            <div className="mt-1 text-2xl font-bold">
              <span className="text-emerald-500">{pods.filter(p => p.status === 'Running' || p.status === 'Succeeded').length}</span>
              <span className="text-muted-foreground mx-1 text-lg">/</span>
              <span>{pods.length}</span>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* 배포 구조도 */}
      <Card className="shadow-sm border-none ring-1 ring-border">
        <CardHeader>
          <CardTitle className="text-lg">배포 구조도 (Deployment Tree)</CardTitle>
          <CardDescription>Argo CD 리소스 계층 구조를 기반으로 한 배포 관계 시각화입니다.</CardDescription>
        </CardHeader>
        <CardContent><ResourceTree nodes={treeNodes} /></CardContent>
      </Card>

      {/* Pod 리스트 테이블 */}
      <Card className="shadow-sm border-none ring-1 ring-border">
        <CardHeader>
          <CardTitle className="text-lg">소속 Pod 리스트</CardTitle>
          <CardDescription>해당 InferenceService에 의해 관리되는 실시간 Pod 목록입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pod Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pod IP</TableHead>
                <TableHead>Node</TableHead>
                <TableHead className="text-center">Restarts</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-[250px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[100px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[40px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[60px]" /></TableCell>
                  </TableRow>
                ))
              ) : pods.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">실행 중인 Pod이 없습니다.</TableCell></TableRow>
              ) : (
                pods.map(pod => (
                  <TableRow key={pod.name}>
                    <TableCell className="font-mono text-xs font-medium">{pod.name}</TableCell>
                    <TableCell>
                      <Badge variant={pod.status === 'Running' ? 'secondary' : 'destructive'} className={pod.status === 'Running' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}>
                        {pod.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{pod.podIp}</TableCell>
                    <TableCell><div className="flex items-center gap-2 text-sm"><Server className="text-muted-foreground h-3.5 w-3.5" />{pod.node}</div></TableCell>
                    <TableCell className="text-center text-sm">{pod.restarts}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{getAge(pod.age)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 에러 분석 섹션 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-semibold">에러 분석 (Error Analysis)</h2>
          <div className="flex items-center gap-3 text-xs overflow-auto max-w-[70%] no-scrollbar">
            {pods.map((p, i) => (
              <div key={p.name} className="flex items-center gap-1.5 shrink-0">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: podColors[i % podColors.length] }} />
                <span className="text-muted-foreground font-mono">{p.name.split('-').slice(-1)}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3">
          {/* 413 Errors */}
          <Card className="shadow-sm border-none ring-1 ring-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">413 (Payload Too Large)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[180px] w-full">
                {!errorMetrics.error413 || errorMetrics.error413.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[9px] font-bold text-muted-foreground uppercase tracking-widest border border-dashed rounded-lg">No 413 Errors</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={errorMetrics.error413}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="time" fontSize={9} tick={{ fill: 'currentColor' }} className="text-muted-foreground" interval={5} />
                      <YAxis fontSize={9} tick={{ fill: 'currentColor' }} className="text-muted-foreground" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '10px' }} />
                      {pods.map((p, i) => (
                        <Bar key={p.name} name={p.name.slice(-8)} dataKey={p.name} stackId="a" fill={podColors[i % podColors.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 429 Errors */}
          <Card className="shadow-sm border-none ring-1 ring-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">429 (Too Many Requests)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[180px] w-full">
                {!errorMetrics.error429 || errorMetrics.error429.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[9px] font-bold text-muted-foreground uppercase tracking-widest border border-dashed rounded-lg">No 429 Errors</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={errorMetrics.error429}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="time" fontSize={9} tick={{ fill: 'currentColor' }} className="text-muted-foreground" interval={5} />
                      <YAxis fontSize={9} tick={{ fill: 'currentColor' }} className="text-muted-foreground" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '10px' }} />
                      {pods.map((p, i) => (
                        <Bar key={p.name} name={p.name.slice(-8)} dataKey={p.name} stackId="a" fill={podColors[i % podColors.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Other Errors (5xx) */}
          <Card className="shadow-sm border-none ring-1 ring-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Other Errors (5xx)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[180px] w-full">
                {!errorMetrics.error5xx || errorMetrics.error5xx.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[9px] font-bold text-muted-foreground uppercase tracking-widest border border-dashed rounded-lg">No 5xx Errors</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={errorMetrics.error5xx}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="time" fontSize={9} tick={{ fill: 'currentColor' }} className="text-muted-foreground" interval={5} />
                      <YAxis fontSize={9} tick={{ fill: 'currentColor' }} className="text-muted-foreground" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '10px' }} />
                      {pods.map((p, i) => (
                        <Bar key={p.name} name={p.name.slice(-8)} dataKey={p.name} stackId="a" fill={podColors[i % podColors.length]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 자원 사용량 시계열 차트 */}
      <Card className="shadow-sm border-none ring-1 ring-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">자원 사용량 (Resource Usage)</CardTitle>
            <CardDescription>Pod별 실시간 시스템 자원 사용률 변화입니다.</CardDescription>
          </div>
          <div className="flex bg-muted p-1 rounded-md">
            {[
              { id: 'cpu', label: 'CPU' },
              { id: 'memory', label: 'Memory' },
              { id: 'gpu', label: 'GPU' },
              { id: 'gpu_mem', label: 'GPU Mem' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveResourceTab(tab.id as any)}
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${
                  activeResourceTab === tab.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {['gpu', 'gpu_mem'].includes(activeResourceTab) && 
             (activeResourceTab === 'gpu' ? resourceMetrics.gpu.length === 0 : resourceMetrics.gpuMem.length === 0) ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                <Activity size={32} className="opacity-20" />
                <div className="text-center">
                  <p className="text-sm font-bold uppercase tracking-widest">No GPU Detected</p>
                  <p className="text-[10px] font-medium mt-1">This service is likely running on CPU only.</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={
                    activeResourceTab === 'cpu' ? resourceMetrics.cpu :
                    activeResourceTab === 'memory' ? resourceMetrics.memory :
                    activeResourceTab === 'gpu' ? resourceMetrics.gpu :
                    resourceMetrics.gpuMem
                  }
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fill: 'currentColor' }} className="text-muted-foreground" fontSize={12} tickLine={{ stroke: 'hsl(var(--border))' }} axisLine={{ stroke: 'hsl(var(--border))' }} interval={4} />
                  <YAxis
                    tick={{ fill: 'currentColor' }}
                    className="text-muted-foreground"
                    fontSize={12}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    domain={[0, 'auto']}
                    tickFormatter={(value) => `${value}%`}
                  />

                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', border: '1px solid hsl(var(--border))', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend iconType="circle" />
                  {pods.map((p, i) => (
                    <Line key={p.name} name={p.name.slice(-8)} type="linear" dataKey={p.name} stroke={podColors[i % podColors.length]} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 실시간 트래픽 분석 섹션 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pod별 RPS 시계열 차트 */}
        <Card className="shadow-sm border-none ring-1 ring-border">
          <CardHeader>
            <CardTitle className="text-lg">Pod별 초당 요청수 (RPS)</CardTitle>
            <CardDescription>최근 30분간 각 Pod으로 유입된 트래픽 변화량입니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              {!trafficMetrics.rps || trafficMetrics.rps.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted/5 rounded-xl border border-dashed">
                  <Activity size={24} className="opacity-20" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No Traffic Detected</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trafficMetrics.rps} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" tick={{ fill: 'currentColor' }} className="text-muted-foreground" fontSize={10} interval={4} />
                    <YAxis tick={{ fill: 'currentColor' }} className="text-muted-foreground" fontSize={10} tickFormatter={(v) => v.toFixed(1)} domain={[0, 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                    <Legend iconType="circle" />
                    {pods.map((p, i) => (
                      <Line key={p.name} name={p.name.slice(-8)} type="linear" dataKey={p.name} stroke={podColors[i % podColors.length]} strokeWidth={1.5} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 레이턴시 시계열 차트 */}
        <Card className="shadow-sm border-none ring-1 ring-border">
          <CardHeader>
            <CardTitle className="text-lg">Pod별 레이턴시 (P95 Latency)</CardTitle>
            <CardDescription>최근 30분간 상위 95% 응답 속도 추이입니다. (단위: ms)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              {!trafficMetrics.latency || trafficMetrics.latency.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted/5 rounded-xl border border-dashed">
                  <Activity size={24} className="opacity-20" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No Response Data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trafficMetrics.latency} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" tick={{ fill: 'currentColor' }} className="text-muted-foreground" fontSize={10} interval={4} />
                    <YAxis tick={{ fill: 'currentColor' }} className="text-muted-foreground" fontSize={10} tickFormatter={(v) => `${v}ms`} domain={[0, 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                    <Legend iconType="circle" />
                    {pods.map((p, i) => (
                      <Line key={p.name} name={p.name.slice(-8)} type="linear" dataKey={p.name} stroke={podColors[i % podColors.length]} strokeWidth={1.5} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 큐 대기수 시계열 차트 */}
      <Card className="shadow-sm border-none ring-1 ring-border">
        <CardHeader>
          <CardTitle className="text-lg">큐 대기수 (Queue Size)</CardTitle>
          <CardDescription>서빙 엔진의 추론 대기열에 쌓여있는 요청 수 추이입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {!engineInfo.name.includes('TEI') ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                <Activity size={32} className="opacity-20" />
                <div className="text-center">
                  <p className="text-sm font-bold uppercase tracking-widest">No Queue Metrics</p>
                  <p className="text-[10px] font-medium mt-1">Queue analysis is optimized for Text Embeddings Inference (TEI).</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trafficMetrics.queue}
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fill: 'currentColor' }} className="text-muted-foreground" fontSize={12} tickLine={{ stroke: 'hsl(var(--border))' }} axisLine={{ stroke: 'hsl(var(--border))' }} interval={4} />
                  <YAxis tick={{ fill: 'currentColor' }} className="text-muted-foreground" fontSize={12} tickLine={{ stroke: 'hsl(var(--border))' }} axisLine={{ stroke: 'hsl(var(--border))' }} domain={[0, 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  <Legend iconType="circle" />
                  {pods.map((p, i) => (
                    <Line key={p.name} name={p.name.slice(-8)} type="linear" dataKey={p.name} stroke={podColors[i % podColors.length]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
      
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 font-bold flex items-center gap-2"><XCircle className="size-4" />{error}</div>}
    </div>
  )
}
