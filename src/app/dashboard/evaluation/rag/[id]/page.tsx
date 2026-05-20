import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  evalAllCases,
  evalDataset,
  evalPipelineRuns,
  type EvalGateResult,
  type EvalPipelineStatus,
  type FailureCategory,
} from '@/lib/eval-mock-data'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Database,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

function formatDuration(sec: number) {
  if (sec === 0) return '-'
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

function relativeTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000 / 60)
  if (diff < 1) return '방금 전'
  if (diff < 60) return `${diff}분 전`
  if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`
  return `${Math.floor(diff / 1440)}일 전`
}

function StepStatus({ status }: { status: EvalPipelineStatus }) {
  if (status === 'success') return <CheckCircle2 className="h-5 w-5 text-green-500" />
  if (status === 'failed')  return <XCircle      className="h-5 w-5 text-red-500" />
  if (status === 'running') return <Loader2      className="h-5 w-5 animate-spin text-blue-500" />
  return <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground/40" />
}

function GateBadge({ result }: { result: EvalGateResult }) {
  if (result === 'passed')
    return <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400"><ShieldCheck className="h-4 w-4" /> Gate 통과 · 배포 승인</span>
  if (result === 'blocked')
    return <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400"><ShieldAlert className="h-4 w-4" /> Gate 차단 · 배포 블로킹</span>
  if (result === 'running')
    return <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"><Loader2 className="h-4 w-4 animate-spin" /> 평가 중</span>
  return <span className="text-sm text-muted-foreground">대기 중</span>
}

function FailureCategoryBadge({ cat }: { cat: FailureCategory }) {
  const map = {
    retrieval:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    generation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    both:       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${map[cat]}`}>{cat}</span>
}

export default async function RagEvalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const run = evalPipelineRuns.find((r) => r.id === id)
  if (!run) notFound()

  const cases       = evalAllCases[run.id] ?? []
  const failedCases = cases.filter((c) => c.status === 'failed')
  const passedCases = cases.filter((c) => c.status === 'passed')

  const failureByCategory = {
    retrieval:  failedCases.filter((c) => c.failureCategory === 'retrieval').length,
    generation: failedCases.filter((c) => c.failureCategory === 'generation').length,
    both:       failedCases.filter((c) => c.failureCategory === 'both').length,
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Link
          href="/dashboard/evaluation/rag"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> RAG 평가 목록으로
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-xl font-bold">{run.id}</h1>
            <p className="text-sm text-muted-foreground">
              {run.modelVersion} · {run.datasetVersion} · {relativeTime(run.startedAt)}
            </p>
          </div>
          <GateBadge result={run.gateResult} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">실행 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              { label: '실행 ID',    value: run.id },
              { label: '모델 버전', value: run.modelVersion },
              { label: '데이터셋',  value: `${run.datasetVersion} (${run.datasetSize}개)` },
              { label: '트리거',    value: run.trigger },
              { label: '총 소요시간', value: formatDuration(run.durationSec) },
              { label: '시작 시각', value: new Date(run.startedAt).toLocaleString('ko-KR') },
            ].map((row) => (
              <div key={row.label} className="flex justify-between border-b pb-1.5 last:border-0">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono font-medium">{row.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">스텝별 실행 결과</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {run.steps.map((step, i) => (
              <div key={step.name}>
                <div className="flex items-center gap-3">
                  <StepStatus status={step.status} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{step.name}</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(step.durationSec)}
                      </div>
                    </div>
                  </div>
                </div>
                {i < run.steps.length - 1 && (
                  <div className="ml-[10px] h-3 w-px bg-border" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {run.status !== 'running' && run.status !== 'pending' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">통과율</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-3xl font-bold">{run.passRate}%</div>
              <Progress value={run.passRate} className="h-2" />
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md bg-muted p-2">
                  <p className="font-bold">{run.total}</p>
                  <p className="text-muted-foreground">전체</p>
                </div>
                <div className="rounded-md bg-green-50 p-2 dark:bg-green-900/20">
                  <p className="font-bold text-green-600">{run.passed}</p>
                  <p className="text-muted-foreground">통과</p>
                </div>
                <div className="rounded-md bg-red-50 p-2 dark:bg-red-900/20">
                  <p className="font-bold text-red-500">{run.failed}</p>
                  <p className="text-muted-foreground">실패</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">실패 원인 분류</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Object.entries(failureByCategory) as [FailureCategory, number][]).map(([cat, count]) => (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <FailureCategoryBadge cat={cat} />
                    <span className="text-muted-foreground">
                      {count}건 ({run.failed > 0 ? Math.round((count / run.failed) * 100) : 0}%)
                    </span>
                  </div>
                  <Progress
                    value={run.failed > 0 ? (count / run.failed) * 100 : 0}
                    className="h-1.5"
                  />
                </div>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">
                retrieval = 청크 검색 실패 · generation = 답변 생성 품질 부족 · both = 두 단계 모두 문제
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {cases.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">테스트 케이스 목록</CardTitle>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />{passedCases.length}개 통과</span>
                <span className="flex items-center gap-1"><XCircle className="h-3.5 w-3.5 text-red-500" />{failedCases.length}개 실패</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">ID</th>
                    <th className="px-4 py-2 text-left font-medium">카테고리</th>
                    <th className="px-4 py-2 text-left font-medium">쿼리</th>
                    <th className="px-4 py-2 text-left font-medium">실패 원인</th>
                    <th className="px-4 py-2 text-right font-medium">Retrieval</th>
                    <th className="px-4 py-2 text-right font-medium">Faithfulness</th>
                    <th className="px-4 py-2 text-right font-medium">Relevancy</th>
                    <th className="px-4 py-2 text-left font-medium">결과</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((tc, i) => (
                    <tr
                      key={tc.id}
                      className={`border-b hover:bg-muted/30 ${tc.status === 'failed' ? 'bg-red-50/50 dark:bg-red-900/5' : i % 2 === 0 ? '' : 'bg-muted/10'}`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs">{tc.id}</td>
                      <td className="px-4 py-2.5 text-xs">{tc.category}</td>
                      <td className="max-w-[200px] truncate px-4 py-2.5 text-xs" title={tc.query}>{tc.query}</td>
                      <td className="px-4 py-2.5">
                        {tc.failureCategory
                          ? <FailureCategoryBadge cat={tc.failureCategory} />
                          : <span className="text-xs text-muted-foreground">-</span>}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono text-xs ${tc.retrievalScore < 0.5 ? 'font-semibold text-red-500' : ''}`}>
                        {tc.retrievalScore.toFixed(2)}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono text-xs ${tc.faithfulness < 0.5 ? 'font-semibold text-red-500' : ''}`}>
                        {tc.faithfulness.toFixed(2)}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono text-xs ${tc.answerRelevancy < 0.5 ? 'font-semibold text-red-500' : ''}`}>
                        {tc.answerRelevancy.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5">
                        {tc.status === 'passed'
                          ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                          : <XCircle className="h-4 w-4 text-red-500" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">사용된 데이터셋</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">이름</p>
            <p className="font-mono font-medium">{evalDataset.name} {run.datasetVersion}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">S3 경로</p>
            <p className="font-mono text-xs text-muted-foreground">{evalDataset.s3Path}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">케이스 수</p>
            <p className="font-medium">{run.datasetSize}개</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
