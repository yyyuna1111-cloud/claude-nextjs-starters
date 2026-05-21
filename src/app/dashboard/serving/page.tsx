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
  Layers,
  ExternalLink
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

// 1. Argo CD 리소스 상세 정보 인터페이스 추가 (전달주신 스키마 기반)
interface ArgoResource {
  group?: string
  kind: string
  name: string
  namespace: string
  status?: string
}

interface ISVC {
  name: string
  namespace: string
  status: 'Ready' | 'NotReady'
  node: string
  createdAt: string
  appName?: string // 매핑된 Argo App 이름
}

interface ArgoApp {
  metadata: {
    name: string
    namespace: string
    uid: string
    creationTimestamp: string
  }
  spec: {
    project: string
    source: {
      repoURL: string
      targetRevision: string
    }
  }
  status: {
    sync: {
      status: 'Synced' | 'OutOfSync' | 'Unknown'
    }
    health: {
      status: 'Healthy' | 'Progressing' | 'Degraded' | 'Missing' | 'Unknown'
    }
    // 2. 전달주신 스키마의 핵심 필드: 이 앱이 관리하는 하위 리소스들
    resources?: ArgoResource[] 
  }
}

export default function ServingPage() {
  const [isvcs, setIsvcs] = useState<ISVC[]>([])
  const [argoApps, setArgoApps] = useState<ArgoApp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchResources = async () => {
    setLoading(true)
    setError(null)
    try {
      // 3. 실제 환경에서는 API 응답을 가공하여 매핑합니다.
      const res = await fetch('/api/k8s/resources')
      const data = await res.json()
      
      // 가상의 Argo CD Apps 데이터 (resources 필드 포함)
      const mockApps: ArgoApp[] = [
        {
          metadata: {
            name: 'bert-serving-app',
            namespace: 'argocd',
            uid: 'uid-001',
            creationTimestamp: '2024-05-10T10:00:00Z',
          },
          spec: {
            project: 'default',
            source: { repoURL: 'https://github.com/mlops/manifests.git', targetRevision: 'main' },
          },
          status: {
            sync: { status: 'Synced' },
            health: { status: 'Healthy' },
            // 이 앱이 'bert-korean-v1' 이라는 InferenceService를 관리함
            resources: [
              { kind: 'InferenceService', name: 'bert-korean-v1', namespace: 'mlops' },
              { kind: 'Service', name: 'bert-korean-v1-predictor-default', namespace: 'mlops' }
            ]
          },
        },
        {
          metadata: {
            name: 'sd-xl-deployment',
            namespace: 'argocd',
            uid: 'uid-002',
            creationTimestamp: '2024-05-15T14:30:00Z',
          },
          spec: {
            project: 'ml-serving',
            source: { repoURL: 'https://github.com/mlops/resnet-api.git', targetRevision: 'v1.2.0' },
          },
          status: {
            sync: { status: 'OutOfSync' },
            health: { status: 'Progressing' },
            // 이 앱이 'stable-diffusion-xl' 이라는 InferenceService를 관리함
            resources: [
              { kind: 'InferenceService', name: 'stable-diffusion-xl', namespace: 'mlops' }
            ]
          },
        },
      ]

      // 4. 매핑 로직 시뮬레이션: ISVC 리스트를 순회하며 관리 App을 찾습니다.
      const rawIsvcs = data.isvcs || [
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
        }
      ]

      const mappedIsvcs = rawIsvcs.map((isvc: ISVC) => {
        // 이 ISVC를 status.resources에 포함하고 있는 App 찾기
        const managingApp = mockApps.find(app => 
          app.status.resources?.some(r => r.kind === 'InferenceService' && r.name === isvc.name)
        )
        return {
          ...isvc,
          appName: managingApp ? managingApp.metadata.name : 'Unknown'
        }
      })

      setIsvcs(mappedIsvcs)
      setArgoApps(mockApps)

    } catch (err: unknown) {
      console.error('Fetch error:', err)
      setError('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResources()
  }, [])

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

  const getSyncBadge = (status: string) => {
    switch (status) {
      case 'Synced':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Synced</Badge>
      case 'OutOfSync':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">OutOfSync</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'Healthy':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 border-transparent text-white">Healthy</Badge>
      case 'Progressing':
        return <Badge className="bg-blue-500 hover:bg-blue-600 border-transparent text-white">Progressing</Badge>
      case 'Degraded':
        return <Badge variant="destructive">Degraded</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Serving & Deployment</h1>
          <p className="text-muted-foreground text-sm">
            Argo CD 배포 관리 및 모델 서빙(ISVC) 인스턴스 현황
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

      {/* 요약 섹션 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-emerald-50/30 border-emerald-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-emerald-600 uppercase">정상 서빙 중</CardTitle>
            <div className="text-2xl font-bold">{isvcs.filter(i => i.status === 'Ready').length}</div>
          </CardHeader>
        </Card>
        <Card className="bg-amber-50/30 border-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-amber-600 uppercase">동기화 필요 (Argo)</CardTitle>
            <div className="text-2xl font-bold">{argoApps.filter(a => a.status.sync.status !== 'Synced').length}</div>
          </CardHeader>
        </Card>
        <Card className="bg-blue-50/30 border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-blue-600 uppercase">전체 배포 앱</CardTitle>
            <div className="text-2xl font-bold">{argoApps.length}</div>
          </CardHeader>
        </Card>
        <Card className="bg-slate-50/30 border-slate-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-600 uppercase">전체 ISVC</CardTitle>
            <div className="text-2xl font-bold">{isvcs.length}</div>
          </CardHeader>
        </Card>
      </div>

      {/* 1. Argo CD Applications 섹션 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Activity className="size-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Argo CD Applications</h2>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Application Name</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Sync Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead className="pr-6">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-6"><Skeleton className="h-5 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[200px]" /></TableCell>
                      <TableCell className="pr-6"><Skeleton className="h-5 w-[50px]" /></TableCell>
                    </TableRow>
                  ))
                ) : argoApps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      배포된 애플리케이션이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  argoApps.map(app => (
                    <TableRow key={app.metadata.uid}>
                      <TableCell className="pl-6 font-medium">
                        <div className="flex flex-col">
                          <span>{app.metadata.name}</span>
                          <span className="text-muted-foreground text-[10px]">{app.metadata.namespace}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {app.spec.project}
                      </TableCell>
                      <TableCell>
                        {getSyncBadge(app.status.sync.status)}
                      </TableCell>
                      <TableCell>
                        {getHealthBadge(app.status.health.status)}
                      </TableCell>
                      <TableCell className="text-xs font-mono max-w-[200px] truncate">
                        <div className="flex flex-col">
                          <span className="truncate" title={app.spec.source.repoURL}>{app.spec.source.repoURL}</span>
                          <span className="text-muted-foreground">{app.spec.source.targetRevision}</span>
                        </div>
                      </TableCell>
                      <TableCell className="pr-6 text-muted-foreground text-sm whitespace-nowrap text-right">
                        {getAge(app.metadata.creationTimestamp)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* 2. InferenceServices 섹션 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Layers className="size-5 text-indigo-600" />
          <h2 className="text-xl font-semibold">InferenceServices (KServe)</h2>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Service Name</TableHead>
                  <TableHead>Managed By</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Primary Node</TableHead>
                  <TableHead className="pr-6 text-right">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-6"><Skeleton className="h-5 w-[150px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>
                      <TableCell className="pr-6"><Skeleton className="h-5 w-[50px]" /></TableCell>
                    </TableRow>
                  ))
                ) : isvcs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      등록된 서비스가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  isvcs.map(isvc => (
                    <TableRow key={isvc.name}>
                      <TableCell className="pl-6 font-medium">
                        <Link
                          href={`/dashboard/serving/${isvc.name}?ns=${isvc.namespace}`}
                          className="flex flex-col hover:underline group"
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{isvc.name}</span>
                            <span className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">상세보기 →</span>
                          </div>
                          <span className="text-muted-foreground text-[10px]">{isvc.namespace}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Box className="size-3 text-blue-500" />
                          <span className="text-xs font-semibold text-blue-600">{isvc.appName}</span>
                          <ExternalLink className="size-3 text-slate-300" />
                        </div>
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
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Server className="h-3.5 w-3.5" />
                          {isvc.node}
                        </div>
                      </TableCell>
                      <TableCell className="pr-6 text-muted-foreground text-sm text-right">
                        {getAge(isvc.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  )
}
