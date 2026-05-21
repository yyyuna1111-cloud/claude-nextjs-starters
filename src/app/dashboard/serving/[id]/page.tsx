'use client'

import { useEffect, useState } from 'react'
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

import {
  LineChart,
  Line,
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

  const [pods, setPods] = useState<Pod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPods = async () => {
    setLoading(true)
    setError(null)
    try {
      // 실제 구현 시에는 특정 ISVC의 Pod만 가져오는 API가 필요합니다.
      // 여기서는 구조 구성을 위해 가상 데이터를 사용하거나 전체 리소스를 필터링합니다.
      const res = await fetch(`/api/k8s/resources`)
      const data = await res.json()
      
      if (data.error) throw new Error(data.error)

      // 실제 데이터가 연결되면 아래 필터링 로직을 사용합니다.
      // const filteredPods = data.pods.filter((p: any) => p.name.includes(id))
      // setPods(filteredPods)

      // 현재는 구조 구성을 위한 더미 데이터를 표시합니다.
      setTimeout(() => {
        setPods([
          {
            name: `${id}-predictor-default-00001-deployment-7f8b9`,
            status: 'Running',
            node: 'gpu-node-01',
            podIp: '10.244.1.45',
            restarts: 0,
            age: '2d 4h',
          },
          {
            name: `${id}-predictor-default-00001-deployment-8c2d1`,
            status: 'Running',
            node: 'gpu-node-02',
            podIp: '10.244.2.12',
            restarts: 1,
            age: '1d 12h',
          },
        ])
        setLoading(false)
      }, 500)

    } catch (err: unknown) {
      console.error('Fetch error:', err)
      setError('Pod 정보를 불러오는 중 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPods()
  }, [id, namespace])

  return (
    <div className="space-y-6">
      {/* 상단 네비게이션 및 헤더 */}
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/serving"
          className="text-muted-foreground hover:text-foreground flex items-center text-sm transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          목록으로 돌아가기
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{id}</h1>
              <Badge variant="outline" className="text-xs font-normal">
                {namespace}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              InferenceService 상세 정보 및 소속 Pod 현황
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPods}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 요약 정보 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
              서빙 엔진
            </CardTitle>
            <div className="mt-1 flex items-center gap-1.5 text-xl font-bold text-blue-600">
              <Activity className="h-5 w-5" />
              TEI (v1.2)
            </div>
          </CardHeader>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="py-4">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
              Container Image
            </CardTitle>
            <div className="mt-1 flex items-center gap-2 font-mono text-sm font-medium overflow-hidden">
              <Box className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="truncate">ghcr.io/huggingface/text-embeddings-inference:1.2</span>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
              가동 중 / 총 Pod
            </CardTitle>
            <div className="mt-1 text-2xl font-bold">
              <span className="text-emerald-500">{pods.filter(p => p.status === 'Running').length}</span>
              <span className="text-muted-foreground mx-1 text-lg">/</span>
              <span>{pods.length}</span>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Pod 리스트 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">소속 Pod 리스트</CardTitle>
          <CardDescription>
            해당 InferenceService에 의해 관리되는 실시간 Pod 목록입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pod Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pod IP</TableHead>
                <TableHead>Node</TableHead>
                <TableHead>Restarts</TableHead>
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
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    실행 중인 Pod이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                pods.map(pod => (
                  <TableRow key={pod.name}>
                    <TableCell className="font-mono text-xs font-medium">
                      {pod.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={pod.status === 'Running' ? 'secondary' : 'destructive'}
                        className={pod.status === 'Running' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}
                      >
                        {pod.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {pod.podIp}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Server className="text-muted-foreground h-3.5 w-3.5" />
                        {pod.node}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {pod.restarts}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {pod.age}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Pod별 RPS 시계열 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pod별 초당 요청수 (RPS)</CardTitle>
          <CardDescription>
            최근 30분간 각 Pod으로 유입된 트래픽 변화량입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={[
                  { time: '14:00', pod1: 45, pod2: 38 },
                  { time: '14:05', pod1: 52, pod2: 42 },
                  { time: '14:10', pod1: 48, pod2: 55 },
                  { time: '14:15', pod1: 61, pod2: 48 },
                  { time: '14:20', pod1: 55, pod2: 52 },
                  { time: '14:25', pod1: 68, pod2: 45 },
                  { time: '14:30', pod1: 72, pod2: 58 },
                ]}
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="time"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" />
                <Line
                  name={pods[0]?.name ? `${pods[0].name.slice(-5)}...` : 'Pod 1'}
                  type="monotone"
                  dataKey="pod1"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  name={pods[1]?.name ? `${pods[1].name.slice(-5)}...` : 'Pod 2'}
                  type="monotone"
                  dataKey="pod2"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      {/* 큐 대기수 시계열 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">실시간 큐 대기수 (Queue Size)</CardTitle>
          <CardDescription>
            서빙 엔진의 추론 대기열에 쌓여있는 요청 수 추이입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={[
                  { time: '14:00', size: 2 },
                  { time: '14:05', size: 5 },
                  { time: '14:10', size: 12 },
                  { time: '14:15', size: 8 },
                  { time: '14:20', size: 15 },
                  { time: '14:25', size: 24 },
                  { time: '14:30', size: 18 },
                ]}
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="time"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Line
                  name="Queue Size"
                  type="stepAfter"
                  dataKey="size"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#f59e0b' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
