'use client'

import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import {
  CheckCircle2Icon,
  LoaderCircleIcon,
  ClockIcon,
  AlertCircleIcon,
} from 'lucide-react'

type StepStatus = 'completed' | 'running' | 'pending' | 'failed'

interface StepNodeData extends Record<string, unknown> {
  label: string
  status: StepStatus
  duration?: string | null
}

const statusConfig: Record<
  StepStatus,
  { border: string; bg: string; text: string; icon: React.ReactNode }
> = {
  completed: {
    border: 'border-green-500/50',
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    icon: <CheckCircle2Icon className="size-4 text-green-500" />,
  },
  running: {
    border: 'border-blue-500/50 ring-2 ring-blue-500/20',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    icon: <LoaderCircleIcon className="size-4 animate-spin text-blue-500" />,
  },
  pending: {
    border: 'border-border',
    bg: 'bg-muted/30',
    text: 'text-muted-foreground',
    icon: <ClockIcon className="text-muted-foreground size-4" />,
  },
  failed: {
    border: 'border-red-500/50',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    icon: <AlertCircleIcon className="size-4 text-red-500" />,
  },
}

const statusLabel: Record<StepStatus, string> = {
  completed: '완료',
  running: '진행 중',
  pending: '대기',
  failed: '실패',
}

function StepNode({ data }: NodeProps) {
  const d = data as StepNodeData
  const cfg = statusConfig[d.status]

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${cfg.border} ${cfg.bg} min-w-[110px] text-center shadow-sm`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!border-border !bg-border !size-2"
      />
      <div className="flex flex-col items-center gap-1.5">
        {cfg.icon}
        <span className="text-foreground text-sm font-semibold">{d.label}</span>
        <span className={`text-xs ${cfg.text}`}>{statusLabel[d.status]}</span>
        {d.duration && (
          <span className="text-muted-foreground text-xs">{d.duration}</span>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!border-border !bg-border !size-2"
      />
    </div>
  )
}

const nodeTypes = { step: StepNode }

interface PipelineStep {
  id: string
  label: string
  status: StepStatus
  duration?: string | null
  dependsOn?: string[]
}

interface PipelineDagProps {
  steps: PipelineStep[]
}

export function PipelineDag({ steps }: PipelineDagProps) {
  const nodes: Node[] = steps.map((step, i) => ({
    id: step.id,
    type: 'step',
    position: { x: i * 180, y: 0 },
    data: { label: step.label, status: step.status, duration: step.duration },
  }))

  const edges: Edge[] = steps.flatMap(step =>
    (
      step.dependsOn ??
      (steps[steps.indexOf(step) - 1]
        ? [steps[steps.indexOf(step) - 1].id]
        : [])
    ).map(source => ({
      id: `${source}-${step.id}`,
      source,
      target: step.id,
      animated: step.status === 'running',
      style: {
        stroke: step.status === 'running' ? '#3b82f6' : '#475569',
        strokeWidth: 1.5,
      },
    }))
  )

  return (
    <div className="h-[160px] w-full overflow-hidden rounded-lg border">
      <ReactFlow
        key={steps.map(s => s.id).join(',')}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#334155" gap={20} size={1} />
      </ReactFlow>
    </div>
  )
}
