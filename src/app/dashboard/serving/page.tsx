'use client'

import { useEffect, useState, useMemo } from 'react'
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
  ExternalLink,
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  labels?: Record<string, string>
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
    resources?: ArgoResource[] 
  }
}

interface MergedService {
  name: string
  namespace: string
  argoAppName: string | null
  syncStatus: 'Synced' | 'OutOfSync' | 'Unknown' | 'Manual'
  healthStatus: 'Healthy' | 'Progressing' | 'Degraded' | 'Missing' | 'Unknown' | 'N/A'
  isvcStatus: 'Ready' | 'NotReady' | 'N/A'
  url: string
  node: string
  createdAt: string
  repoURL?: string
  targetRevision?: string
}

interface RolloutTask {
  id: string
  modelName: string
  namespace: string
  status: 'deploying' | 'failed'
  currentStep: number
  steps: {
    title: string
    status: 'completed' | 'current' | 'pending'
  }[]
}

export default function ServingPage() {
  const [services, setServices] = useState<MergedService[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 검색 및 필터 상태
  const [search, setSearch] = useState('')
  const [managedFilter, setManagedFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortConfig, setSortConfig] = useState<{ key: keyof MergedService; direction: 'asc' | 'desc' }>({
    key: 'createdAt',
    direction: 'desc', // 최신순 기본
  })

  // Active Rollouts Mock Data (K8s에 아직 안 나타난 서비스 포함)
  const activeRollouts: RolloutTask[] = [
    {
      id: 'rollout-1',
      modelName: 'user-behavior-analysis',
      namespace: 'serving',
      status: 'deploying',
      currentStep: 2,
      steps: [
        { title: 'Git Push', status: 'completed' },
        { title: 'ArgoCD Reg', status: 'current' },
        { title: 'Syncing', status: 'pending' },
        { title: 'K8s Ready', status: 'pending' },
        { title: 'Alert Sent', status: 'pending' },
      ]
    }
  ]

  const fetchResources = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. 실제 K8s InferenceService 데이터 가져오기
      const res = await fetch('/api/k8s/isvcs')
      if (!res.ok) throw new Error('ISVC API Error')
      const k8sData = await res.json()
      const rawIsvcs: ISVC[] = k8sData.isvcs || []

      // 2. 임시 Argo CD Apps 데이터
      const mockApps: ArgoApp[] = [
        {
          metadata: { name: 'kie-serving-app', namespace: 'argocd', uid: 'u1', creationTimestamp: '2024-05-10T00:00:00Z' },
          spec: { project: 'default', source: { repoURL: 'https://git.internal/kie-manifests.git', targetRevision: 'main' } },
          status: { sync: { status: 'Synced' }, health: { status: 'Healthy' }, resources: [{ kind: 'InferenceService', name: 'kie', namespace: 'serving' }] }
        },
        {
          metadata: { name: 'sjko-app', namespace: 'argocd', uid: 'u2', creationTimestamp: '2024-05-10T00:00:00Z' },
          spec: { project: 'default', source: { repoURL: 'https://git.internal/sjko-model.git', targetRevision: 'v1.1' } },
          status: { sync: { status: 'OutOfSync' }, health: { status: 'Healthy' }, resources: [{ kind: 'InferenceService', name: 'sjko-embedding', namespace: 'serving' }] }
        }
      ]

      const merged = rawIsvcs.map(isvc => {
        const managingApp = mockApps.find(app => 
          app.status.resources?.some(r => r.kind === 'InferenceService' && r.name === isvc.name) ||
          isvc.labels?.['app.kubernetes.io/instance'] === app.metadata.name
        )

        return {
          name: isvc.name,
          namespace: isvc.namespace,
          argoAppName: managingApp ? managingApp.metadata.name : null,
          syncStatus: managingApp ? managingApp.status.sync.status : (isvc.namespace === 'serving' ? 'Unknown' : 'Manual'),
          healthStatus: managingApp ? managingApp.status.health.status : 'N/A',
          isvcStatus: isvc.status,
          url: isvc.url || '',
          node: isvc.node,
          createdAt: isvc.createdAt,
          repoURL: managingApp?.spec.source.repoURL,
          targetRevision: managingApp?.spec.source.targetRevision
        }
      })

      setServices(merged)
    } catch (err) {
      console.error('[ServingPage] Fetch Error:', err)
      setError('클러스터에서 InferenceService 정보를 가져오는데 실패했습니다.')
      setServices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResources()
  }, [])

  const toggleSort = (key: keyof MergedService) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const filteredAndSortedServices = useMemo(() => {
    let result = [...services]

    if (search) {
      const lowSearch = search.toLowerCase()
      result = result.filter(s => 
        s.name.toLowerCase().includes(lowSearch) || 
        s.namespace.toLowerCase().includes(lowSearch) ||
        (s.argoAppName?.toLowerCase().includes(lowSearch))
      )
    }

    if (managedFilter !== 'all') {
      if (managedFilter === 'gitops') result = result.filter(s => s.argoAppName)
      else if (managedFilter === 'manual') result = result.filter(s => !s.argoAppName)
    }

    if (statusFilter !== 'all') {
      result = result.filter(s => s.isvcStatus === statusFilter)
    }

    result.sort((a: any, b: any) => {
      let aVal = a[sortConfig.key]
      let bVal = b[sortConfig.key]
      if (aVal === null || aVal === undefined) aVal = ''
      if (bVal === null || bVal === undefined) bVal = ''
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [services, search, managedFilter, statusFilter, sortConfig])

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
      case 'Synced': return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Synced</Badge>
      case 'OutOfSync': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">OutOfSync</Badge>
      case 'Manual': return <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 text-[10px]">Manual</Badge>
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>
    }
  }

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'Healthy': return <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-[10px] uppercase tracking-tighter"><div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Healthy</div>
      case 'Progressing': return <div className="flex items-center gap-1.5 text-blue-500 font-bold text-[10px] uppercase tracking-tighter"><RefreshCw className="size-3 animate-spin" /> Syncing</div>
      case 'Degraded': return <div className="flex items-center gap-1.5 text-red-500 font-bold text-[10px] uppercase tracking-tighter"><XCircle className="size-3" /> Degraded</div>
      default: return <span className="text-muted-foreground text-[10px]">{status}</span>
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Service Operation</h1>
          <p className="text-muted-foreground text-sm">
            GitOps 배포 주기와 실시간 모델 추론 상태를 통합 관리합니다.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-sm border-none ring-1 ring-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Services</CardTitle>
            <div className="text-3xl font-bold tracking-tighter">{loading ? '...' : services.length}</div>
          </CardHeader>
        </Card>
        <Card className="shadow-sm border-none ring-1 ring-border bg-blue-50/5 text-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest">GitOps Managed</CardTitle>
            <div className="text-3xl font-bold tracking-tighter">{loading ? '...' : services.filter(s => s.argoAppName).length}</div>
          </CardHeader>
        </Card>
        <Card className="shadow-sm border-none ring-1 ring-border bg-emerald-50/5 text-emerald-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest">Ready Inference</CardTitle>
            <div className="text-3xl font-bold tracking-tighter">{loading ? '...' : services.filter(s => s.isvcStatus === 'Ready').length}</div>
          </CardHeader>
        </Card>
        <Card className="shadow-sm border-none ring-1 ring-border bg-red-50/5 text-red-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest">Critical Alerts</CardTitle>
            <div className="text-3xl font-bold tracking-tighter">{loading ? '...' : services.filter(s => s.syncStatus === 'OutOfSync' || s.isvcStatus === 'NotReady').length}</div>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between bg-card p-4 rounded-xl border ring-1 ring-border shadow-sm">
         <div className="flex flex-1 items-center gap-3 w-full sm:max-w-3xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input 
                placeholder="Search Service, Namespace or App..." 
                className="pl-9 h-10 bg-muted/20 border-none ring-1 ring-border focus-visible:ring-primary/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={managedFilter} onValueChange={setManagedFilter}>
              <SelectTrigger className="w-[140px] h-10 bg-muted/20 border-none ring-1 ring-border">
                <div className="flex items-center gap-2">
                  <Layers className="size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Managed" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="gitops">GitOps</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-10 bg-muted/20 border-none ring-1 ring-border">
                <div className="flex items-center gap-2">
                  <Filter className="size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Ready">Ready</SelectItem>
                <SelectItem value="NotReady">Not Ready</SelectItem>
              </SelectContent>
            </Select>
         </div>
         <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full">
           Showing {filteredAndSortedServices.length} Services
         </div>
      </div>

      <div className="space-y-4">
        <Card className="shadow-sm border-none ring-1 ring-border overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 border-none">
                  <TableHead className="pl-6 font-bold uppercase text-[10px] tracking-widest">
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Service Information <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest">Host / Endpoint</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-center">Managed By</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-center">Status Indicators</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest">
                    <button onClick={() => toggleSort('isvcStatus')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Inference Ready <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                  <TableHead className="pr-6 text-right font-bold uppercase text-[10px] tracking-widest">
                    <button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors">
                      Uptime <ArrowUpDown className="size-3" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={6} className="pl-6 py-6"><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                  ))
                ) : filteredAndSortedServices.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm font-bold uppercase tracking-widest">No services match filters</TableCell></TableRow>
                ) : (
                  filteredAndSortedServices.map(svc => (
                    <TableRow key={svc.name} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <Link href={`/dashboard/serving/${svc.name}?ns=${svc.namespace}`} className="flex flex-col">
                           <span className="font-bold text-sm group-hover:text-primary transition-colors">{svc.name}</span>
                           <span className="text-[10px] text-muted-foreground font-mono mt-0.5">{svc.namespace.toUpperCase()}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        {svc.url ? (
                          <div className="flex items-center gap-2 max-w-[200px]">
                            <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground truncate" title={svc.url}>
                              {svc.url.replace(/^https?:\/\//, '')}
                            </code>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="size-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                navigator.clipboard.writeText(svc.url)
                              }}
                            >
                              <Copy size={12} />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/30 text-[10px]">No Endpoint</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {svc.argoAppName ? (
                          <div className="flex flex-col items-center gap-1">
                             <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-bold">GITOPS</Badge>
                             <span className="text-[10px] text-muted-foreground font-medium">{svc.argoAppName}</span>
                          </div>
                        ) : <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-200 text-[9px] font-bold">MANUAL</Badge>}
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-col items-center gap-1">{getSyncBadge(svc.syncStatus)}{getHealthBadge(svc.healthStatus)}</div>
                      </TableCell>
                      <TableCell>
                         <Badge variant={svc.isvcStatus === 'Ready' ? 'secondary' : 'destructive'} className={svc.isvcStatus === 'Ready' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold text-[10px]' : 'font-bold text-[10px]'}>{svc.isvcStatus}</Badge>
                         <div className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground font-medium"><Server size={10} /> {svc.node}</div>
                      </TableCell>
                      <TableCell className="pr-6 text-right text-xs font-medium text-muted-foreground">{getAge(svc.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 font-bold flex items-center gap-2"><XCircle className="size-4" />{error}</div>}
    </div>
  )
}
