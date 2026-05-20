'use client'

import { useState, useRef } from 'react'
import { PlusIcon, UploadIcon, XIcon, FileIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

interface TrainRequestForm {
  trainName: string
  projectName: string
  trainMode: string
  gpuCount: string
  epochs: string
  learningRate: string
  batchSize: string
  file: File | null
}

const defaultForm: TrainRequestForm = {
  trainName: '',
  projectName: '',
  trainMode: '단일 GPU',
  gpuCount: '1',
  epochs: '10',
  learningRate: '0.001',
  batchSize: '32',
  file: null,
}

export function TrainRequestDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<TrainRequestForm>(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function set(key: keyof TrainRequestForm, value: string | File | null) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    set('file', e.target.files?.[0] ?? null)
  }

  function removeFile() {
    set('file', null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit() {
    if (!form.trainName || !form.projectName) return

    setSubmitting(true)
    try {
      // TODO: KFP API 연동 시 여기서 실제 요청
      await new Promise(r => setTimeout(r, 800))
      setOpen(false)
      setForm(defaultForm)
    } finally {
      setSubmitting(false)
    }
  }

  const isGpu = form.trainMode !== 'CPU 전용'

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon className="mr-2 size-4" />
        학습 요청
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>학습 요청</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="trainName">
                  학습명 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="trainName"
                  placeholder="예: ResNet50 파인튜닝"
                  value={form.trainName}
                  onChange={e => set('trainName', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="projectName">
                  프로젝트명 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="projectName"
                  placeholder="예: 이미지 분류 v2"
                  value={form.projectName}
                  onChange={e => set('projectName', e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* 학습 설정 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>학습 모드</Label>
                <Select
                  value={form.trainMode}
                  onValueChange={v => set('trainMode', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="단일 GPU">단일 GPU</SelectItem>
                    <SelectItem value="분산 학습">분산 학습</SelectItem>
                    <SelectItem value="CPU 전용">CPU 전용</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gpuCount">GPU 개수</Label>
                <Input
                  id="gpuCount"
                  type="number"
                  min={1}
                  max={16}
                  value={form.gpuCount}
                  onChange={e => set('gpuCount', e.target.value)}
                  disabled={!isGpu}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="epochs">에포크</Label>
                <Input
                  id="epochs"
                  type="number"
                  min={1}
                  value={form.epochs}
                  onChange={e => set('epochs', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="learningRate">학습률</Label>
                <Input
                  id="learningRate"
                  type="number"
                  step="0.0001"
                  value={form.learningRate}
                  onChange={e => set('learningRate', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batchSize">배치 사이즈</Label>
                <Input
                  id="batchSize"
                  type="number"
                  min={1}
                  value={form.batchSize}
                  onChange={e => set('batchSize', e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* 파일 업로드 */}
            <div className="space-y-1.5">
              <Label>학습 데이터 파일</Label>
              {form.file ? (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <FileIcon className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {form.file.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {(form.file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="hover:bg-muted/50 cursor-pointer rounded-md border border-dashed px-4 py-6 text-center transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <UploadIcon className="text-muted-foreground mx-auto mb-2 size-6" />
                  <p className="text-muted-foreground text-sm">
                    클릭하여 파일을 업로드하거나 드래그하세요
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    .zip, .tar.gz, .csv, .json 등 지원
                  </p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".zip,.tar.gz,.csv,.json,.yaml,.yml"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !form.trainName || !form.projectName}
            >
              {submitting ? '요청 중...' : '학습 시작'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
