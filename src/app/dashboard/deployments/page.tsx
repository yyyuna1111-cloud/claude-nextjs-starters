'use client'

import { useState } from 'react'
import { 
  GitBranch, 
  Box, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Activity, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  MessageSquare,
  Hash
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

interface DeploymentTask {
  id: string
  modelName: string
  namespace: string
  version: string
  commit: {
    hash: string
    message: string
    author: string
  }
  status: 'deploying' | 'completed' | 'failed'
  startTime: string
  currentStep: number
  steps: {
    title: string
    status: 'completed' | 'current' | 'pending' | 'failed'
    description: string
  }[]
}

export default function DeploymentsPage() {
  // Mock Data: 실제 운영 환경에서는 Git Webhook이나 ArgoCD 이벤트를 통해 수집됨
  const [deployments] = useState<DeploymentTask[]>([
    {
      id: 'dep-001',
      modelName: 'user-behavior-analysis',
      namespace: 'serving',
      version: 'v1.2.0',
      commit: {
        hash: '7f8b9a2',
        message: 'feat: update embedding model to bge-m3',
        author: 'lcy'
      },
      status: 'deploying',
      startTime: '2024-05-10 10:05:22',
      currentStep: 2,
      steps: [
        { title: 'Git Push', status: 'completed', description: 'Manifest committed to main branch' },
        { title: 'ArgoCD App', status: 'current', description: 'Waiting for manual application registration' },
        { title: 'Syncing', status: 'pending', description: 'ArgoCD synchronizing with cluster' },
        { title: 'K8s Deploy', status: 'pending', description: 'KServe InferenceService provisioning' },
        { title: 'Notification', status: 'pending', description: 'Final alert to #ml-deployments' },
      ]
    },
    {
      id: 'dep-002',
      modelName: 'fraud-detection-v3',
      namespace: 'production',
      version: 'v3.0.1',
      commit: {
        hash: 'a1b2c3d',
        message: 'fix: adjust threshold for better precision',
        author: 'kim-dev'
      },
      status: 'completed',
      startTime: '2024-05-09 14:20:10',
      currentStep: 5,
      steps: [
        { title: 'Git Push', status: 'completed', description: 'Manifest committed' },
        { title: 'ArgoCD App', status: 'completed', description: 'Application registered' },
        { title: 'Syncing', status: 'completed', description: 'Resources synced' },
        { title: 'K8s Deploy', status: 'completed', description: 'Healthy and Ready' },
        { title: 'Notification', status: 'completed', description: 'Slack alert sent' },
      ]
    }
  ])

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deployment Timelines</h1>
          <p className="text-muted-foreground text-sm">
            Git 커밋부터 최종 알림 발송까지, 모델의 배포 전 과정을 추적합니다.
          </p>
        </div>
      </div>

      {/* Active Deployments Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
          <Activity className="size-4 text-primary" /> Active Deployments
        </h2>
        
        <div className="grid gap-6">
          {deployments.filter(d => d.status === 'deploying').map(dep => (
            <Card key={dep.id} className="shadow-sm border-none ring-1 ring-border overflow-hidden bg-gradient-to-r from-background to-muted/5">
              <CardHeader className="pb-4 border-b bg-muted/10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Box className="size-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{dep.modelName}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] font-mono">{dep.namespace.toUpperCase()}</Badge>
                        <span className="text-xs text-muted-foreground font-medium">{dep.version}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:items-end gap-1.5 p-3 bg-background/50 rounded-lg border">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                      <GitBranch size={14} className="text-blue-500" /> Commit info
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                         <Hash size={12} className="text-muted-foreground" />
                         <span className="text-[11px] font-mono font-bold text-blue-600 underline underline-offset-4 decoration-blue-200 cursor-pointer">{dep.commit.hash}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-[200px]">
                        <MessageSquare size={12} /> {dep.commit.message}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-8 pb-10">
                <div className="relative flex justify-between px-4">
                  <div className="absolute top-5 left-10 right-10 h-0.5 bg-muted -z-0" />
                  
                  {dep.steps.map((step, idx) => (
                    <div key={idx} className="relative z-10 flex flex-col items-center group flex-1">
                      <div className={`size-10 rounded-full border-4 flex items-center justify-center transition-all ${
                        step.status === 'completed' ? 'bg-emerald-500 border-emerald-100 text-white' :
                        step.status === 'current' ? 'bg-background border-primary text-primary animate-ring ring-4 ring-primary/20' :
                        'bg-background border-muted text-muted-foreground'
                      }`}>
                        {step.status === 'completed' ? (
                          <CheckCircle2 className="size-5" />
                        ) : step.status === 'current' ? (
                          <RefreshCw className="size-5 animate-spin" />
                        ) : (
                          <span className="text-xs font-bold">{idx + 1}</span>
                        )}
                      </div>
                      <div className="mt-4 text-center">
                        <p className={`text-[11px] font-bold uppercase tracking-tighter ${
                          step.status === 'current' ? 'text-primary' : 'text-foreground'
                        }`}>{step.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 max-w-[100px] leading-tight font-medium hidden md:block">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Deployment History Section */}
      <div className="space-y-4 pt-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
          <Clock className="size-4 text-slate-500" /> Deployment History
        </h2>
        
        <Card className="shadow-sm border-none ring-1 ring-border">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="pl-6 font-bold uppercase text-[10px] tracking-widest">Model / Version</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest">Commit</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest">Started At</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-widest text-center">Status</TableHead>
                  <TableHead className="pr-6 text-right font-bold uppercase text-[10px] tracking-widest">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.filter(d => d.status !== 'deploying').map(dep => (
                  <TableRow key={dep.id} className="group hover:bg-muted/10 transition-colors">
                    <TableCell className="pl-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{dep.modelName}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded">{dep.namespace.toUpperCase()}</span>
                          <span className="text-[10px] text-muted-foreground font-medium">{dep.version}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-blue-600">
                           <Hash size={10} /> {dep.commit.hash}
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[180px]">{dep.commit.message}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">{dep.startTime}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold text-[10px]">SUCCESS</Badge>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
