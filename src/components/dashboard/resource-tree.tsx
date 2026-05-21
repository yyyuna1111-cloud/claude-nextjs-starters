'use client'

import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import {
  Server,
  Box,
  Layers,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  RefreshCw
} from 'lucide-react'
import { useEffect } from 'react'

// Argo CD Resource Node Types (v1alpha1ResourceNode)
export interface ResourceRef {
  group?: string
  kind: string
  name: string
  namespace?: string
  uid: string
  version?: string
}

export interface ArgoNode extends ResourceRef {
  health?: {
    status: string
    message?: string
    lastTransitionTime?: string
  }
  images?: string[]
  info?: Array<{ name: string; value: string }>
  networkingInfo?: any
  parentRefs?: ResourceRef[]
  resourceVersion?: string
}

export interface ResourceTreeProps {
  nodes: ArgoNode[]
}

const kindConfig: Record<string, { icon: any; color: string; bgColor: string }> = {
  InferenceService: { icon: Activity, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  Predictor: { icon: Cpu, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  Transformer: { icon: RefreshCw, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  Service: { icon: Layers, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  Deployment: { icon: Cpu, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  ReplicaSet: { icon: Box, color: 'text-slate-600', bgColor: 'bg-slate-50' },
  Pod: { icon: Server, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
}

const healthConfig: Record<string, { icon: any; color: string }> = {
  Healthy: { icon: CheckCircle2, color: 'text-emerald-500' },
  Degraded: { icon: AlertCircle, color: 'text-red-500' },
  Progressing: { icon: Activity, color: 'text-blue-500' },
  Missing: { icon: Clock, color: 'text-slate-400' },
  Unknown: { icon: Clock, color: 'text-slate-400' },
}

function ResourceNode({ data }: NodeProps) {
  const d = data as any
  const kind = kindConfig[d.kind] || { icon: Box, color: 'text-slate-500', bgColor: 'bg-slate-50' }
  const health = healthConfig[d.health?.status || 'Unknown'] || healthConfig.Unknown
  const Icon = kind.icon
  const HealthIcon = health.icon

  return (
    <div className={`flex flex-col gap-1 rounded-lg border bg-white p-2.5 shadow-sm min-w-[140px] border-slate-200`}>
      <Handle type="target" position={Position.Left} className="!bg-slate-300" />
      
      <div className="flex items-center justify-between">
        <div className={`p-1 rounded ${kind.bgColor}`}>
          <Icon className={`size-3.5 ${kind.color}`} />
        </div>
        <HealthIcon className={`size-3.5 ${health.color}`} />
      </div>
      
      <div className="flex flex-col mt-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{d.kind}</span>
        <span className="text-xs font-semibold text-slate-700 truncate max-w-[120px]" title={d.name}>
          {d.name}
        </span>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-slate-300" />
    </div>
  )
}

const nodeTypes = { resource: ResourceNode }

export function ResourceTree({ nodes: argoNodes }: ResourceTreeProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    // Simple layout logic: group by kind and stack horizontally
    const kindOrder = ['InferenceService', 'Predictor', 'Service', 'Deployment', 'ReplicaSet', 'Pod']
    const levelMap: Record<string, number> = {}
    
    // Assign levels
    argoNodes.forEach(node => {
      const level = kindOrder.indexOf(node.kind)
      levelMap[node.kind] = level !== -1 ? level : 6
    })

    // Group nodes by level for positioning
    const nodesByLevel: Record<number, ArgoNode[]> = {}
    argoNodes.forEach(node => {
      const lvl = levelMap[node.kind] || 0
      if (!nodesByLevel[lvl]) nodesByLevel[lvl] = []
      nodesByLevel[lvl].push(node)
    })

    const flowNodes: Node[] = []
    const flowEdges: Edge[] = []

    Object.keys(nodesByLevel).forEach(lvlStr => {
      const lvl = parseInt(lvlStr)
      const nodesAtLvl = nodesByLevel[lvl]
      nodesAtLvl.forEach((node, i) => {
        flowNodes.push({
          id: node.uid,
          type: 'resource',
          position: { x: lvl * 220, y: i * 90 },
          data: { ...node },
        })

        // Create edges from parentRefs
        node.parentRefs?.forEach(ref => {
          flowEdges.push({
            id: `${ref.uid}-${node.uid}`,
            source: ref.uid,
            target: node.uid,
            style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
          })
        })
      })
    })

    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [argoNodes, setNodes, setEdges])

  return (
    <div className="h-[300px] w-full overflow-hidden rounded-xl border bg-slate-50/50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={true}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#cbd5e1" gap={20} size={1} />
      </ReactFlow>
    </div>
  )
}
