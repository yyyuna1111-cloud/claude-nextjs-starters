'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Server,
  Activity,
  Box,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
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

interface ISVC {
  name: string
  namespace: string
  status: 'Ready' | 'NotReady'
  node: string
  createdAt: string
}

export default function ServingPage() {
  const [isvcs, setIsvcs] = useState<ISVC[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchResources = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/k8s/resources')
      const data = await res.json()
      if (data.error) {
        throw new Error(data.error)
      }
      setIsvcs(data.isvcs || [])
    } catch (err: unknown) {
      console.error('Fetch error:', err)
      setError('데이터를 불러오는 중 오류가 발생했습니다.')
      // 실제 API 호출 실패 시 더미 데이터 표시 (개발용)
      setIsvcs([
        {
          name: 'bert-korean-v1',
          namespace: 'mlops',
          status: 'Ready',
          node: 'gpu-node-01',
          createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
        },
        {
          name: 'stable-diffusion-xl',
          namespace: 'mlops',
          status: 'NotReady',
          node: 'Pending',
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        },
        {
          name: 'resnet50-api',
          namespace: 'serving',
          status: 'Ready',
          node: 'cpu-node-02',
          createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResources()
  }, [])

  // Age 계산 함수
  const getAge = (createdAt: string) => {
    const created = new Date(createdAt)
    const diff = Date.now() - created.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    const mins = Math.floor((diff / (1000 * 60)) % 60)

    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Serving</h1>
          <p className="text-muted-foreground text-sm">
            BERT / RoBERTa 등 임베딩 모델 서빙 및 오토스케일링 모니터링
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchResources}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 서비스</CardTitle>
            <Box className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isvcs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">정상 가동</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isvcs.filter(i => i.status === 'Ready').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">비정상/대기</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isvcs.filter(i => i.status !== 'Ready').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">InferenceService 리스트</CardTitle>
          <CardDescription>
            클러스터에 배포된 모든 ISVC의 실시간 상태입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Node</TableHead>
                <TableHead>Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-[150px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[50px]" /></TableCell>
                  </TableRow>
                ))
              ) : isvcs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    등록된 서비스가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                isvcs.map(isvc => (
                  <TableRow key={isvc.name}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/serving/${isvc.name}?ns=${isvc.namespace}`}
                        className="flex flex-col hover:underline"
                      >
                        <span>{isvc.name}</span>
                        <span className="text-muted-foreground text-xs">{isvc.namespace}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={isvc.status === 'Ready' ? 'secondary' : 'destructive'}
                        className={isvc.status === 'Ready' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}
                      >
                        {isvc.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Server className="text-muted-foreground h-3.5 w-3.5" />
                        {isvc.node}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {getAge(isvc.createdAt)}
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
    </div>
  )
}
