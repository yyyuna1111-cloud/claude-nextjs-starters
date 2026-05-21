export type Environment = 'prod' | 'staging' | 'dev'
export type EvalPipelineStatus = 'success' | 'failed' | 'running' | 'pending'
export type EvalGateResult = 'passed' | 'blocked' | 'running' | 'pending'
export type FailureCategory = 'retrieval' | 'generation' | 'both'

export interface EmbeddingDeployment {
  environment: Environment
  modelName: string
  modelVersion: string
  dimension: number
  status: 'healthy' | 'degraded' | 'updating' | 'failed'
  replicas: { ready: number; total: number }
  deployedAt: string
  embeddingRps: number
  avgLatencyMs: number
  indexedVectors: number
}

export interface EvalPipelineRun {
  id: string
  modelVersion: string
  datasetVersion: string
  datasetSize: number
  trigger: 'push' | 'schedule' | 'manual'
  status: EvalPipelineStatus
  gateResult: EvalGateResult
  passRate: number
  passed: number
  failed: number
  total: number
  durationSec: number
  startedAt: string
  steps: { name: string; status: EvalPipelineStatus; durationSec: number }[]
}

export interface EvalTestCase {
  id: string
  category: string
  query: string
  status: 'passed' | 'failed'
  failureCategory?: FailureCategory
  retrievalScore: number
  faithfulness: number
  answerRelevancy: number
}

export interface EvalVersionComparison {
  metric: string
  current: number
  previous: number
  threshold: number
  higherIsBetter: boolean
}

export interface EvalDataset {
  name: string
  version: string
  s3Path: string
  totalCases: number
  categories: { name: string; count: number }[]
  lastUpdated: string
}

export interface HeatmapCell {
  hour: string
  category: string
  count: number
  passRate: number
}

export interface ClusterPoint {
  x: number
  y: number
  cluster: 'success' | 'retrieval-fail' | 'generation-fail' | 'both-fail'
}

// ── Embedding Model ───────────────────────────────────────────────────────────

export const embeddingDeployments: EmbeddingDeployment[] = [
  {
    environment: 'prod',
    modelName: 'BAAI/bge-m3',
    modelVersion: 'v1.5.0',
    dimension: 1024,
    status: 'healthy',
    replicas: { ready: 8, total: 8 },
    deployedAt: '2026-05-12T22:00:00Z',
    embeddingRps: 2450,
    avgLatencyMs: 28,
    indexedVectors: 4820000,
  },
  {
    environment: 'staging',
    modelName: 'BAAI/bge-m3',
    modelVersion: 'v1.5.0',
    dimension: 1024,
    status: 'healthy',
    replicas: { ready: 4, total: 4 },
    deployedAt: '2026-05-12T22:00:00Z',
    embeddingRps: 820,
    avgLatencyMs: 30,
    indexedVectors: 4820000,
  },
  {
    environment: 'dev',
    modelName: 'multilingual-e5-large',
    modelVersion: 'v1.2.0-exp',
    dimension: 1024,
    status: 'healthy',
    replicas: { ready: 2, total: 2 },
    deployedAt: '2026-05-15T08:00:00Z',
    embeddingRps: 610,
    avgLatencyMs: 35,
    indexedVectors: 120000,
  },
]

export const embeddingRolloutHistory = [
  { version: 'v1.5.0',     env: 'prod',    deployedAt: '2026-05-12 22:00', status: 'stable'  },
  { version: 'v1.5.0',     env: 'staging', deployedAt: '2026-05-12 22:00', status: 'stable'  },
  { version: 'v1.4.2',     env: 'prod',    deployedAt: '2026-05-05 18:00', status: 'retired' },
  { version: 'v1.4.0',     env: 'prod',    deployedAt: '2026-04-28 14:00', status: 'retired' },
  { version: 'v1.2.0-exp', env: 'dev',     deployedAt: '2026-05-15 08:00', status: 'exp'     },
]

export const embeddingLatencyHistory = [
  { time: '21:00', p50: 26, p95: 44, p99: 67 },
  { time: '22:00', p50: 25, p95: 42, p99: 64 },
  { time: '23:00', p50: 24, p95: 41, p99: 62 },
  { time: '00:00', p50: 23, p95: 39, p99: 59 },
  { time: '01:00', p50: 22, p95: 38, p99: 57 },
  { time: '02:00', p50: 22, p95: 37, p99: 56 },
  { time: '03:00', p50: 23, p95: 39, p99: 58 },
  { time: '04:00', p50: 24, p95: 41, p99: 61 },
  { time: '05:00', p50: 26, p95: 44, p99: 66 },
  { time: '06:00', p50: 28, p95: 47, p99: 70 },
  { time: '07:00', p50: 29, p95: 49, p99: 73 },
  { time: '08:00', p50: 28, p95: 48, p99: 72 },
  { time: '09:00', p50: 28, p95: 48, p99: 71 },
]

export const embeddingVersionComparison = [
  { metric: 'NDCG@1',    current: 0.812, previous: 0.798 },
  { metric: 'NDCG@5',    current: 0.838, previous: 0.821 },
  { metric: 'NDCG@10',   current: 0.847, previous: 0.831 },
  { metric: 'Recall@1',  current: 0.743, previous: 0.724 },
  { metric: 'Recall@5',  current: 0.891, previous: 0.878 },
  { metric: 'Recall@10', current: 0.923, previous: 0.911 },
  { metric: 'MRR',       current: 0.823, previous: 0.808 },
]

export const embeddingQualityTrend = [
  { week: '4/21', ndcg10: 0.821, mrr: 0.798, recall10: 0.904 },
  { week: '4/28', ndcg10: 0.831, mrr: 0.808, recall10: 0.911 },
  { week: '5/5',  ndcg10: 0.838, mrr: 0.814, recall10: 0.916 },
  { week: '5/12', ndcg10: 0.847, mrr: 0.823, recall10: 0.923 },
]

export const embeddingRpsHistory = [
  { time: '21:00', prod: 1980, staging: 720  },
  { time: '22:00', prod: 2100, staging: 810  },
  { time: '23:00', prod: 1850, staging: 690  },
  { time: '00:00', prod: 1400, staging: 520  },
  { time: '01:00', prod: 1100, staging: 410  },
  { time: '02:00', prod:  980, staging: 370  },
  { time: '03:00', prod: 1050, staging: 390  },
  { time: '04:00', prod: 1380, staging: 510  },
  { time: '05:00', prod: 1900, staging: 710  },
  { time: '06:00', prod: 2240, staging: 840  },
  { time: '07:00', prod: 2450, staging: 910  },
  { time: '08:00', prod: 2390, staging: 880  },
  { time: '09:00', prod: 2450, staging: 820  },
]

// ── RAG Evaluation ────────────────────────────────────────────────────────────

export const evalPipelineRuns: EvalPipelineRun[] = [
  {
    id: 'eval-0041',
    modelVersion: 'v2.4.0-rc1',
    datasetVersion: 'rag-testset-v3.2',
    datasetSize: 240,
    trigger: 'push',
    status: 'running',
    gateResult: 'running',
    passRate: 0,
    passed: 0,
    failed: 0,
    total: 240,
    durationSec: 87,
    startedAt: '2026-05-15T09:01:00Z',
    steps: [
      { name: 'data-load',       status: 'success', durationSec: 8  },
      { name: 'retrieval-test',  status: 'success', durationSec: 34 },
      { name: 'generation-test', status: 'running', durationSec: 45 },
      { name: 'report',          status: 'pending', durationSec: 0  },
    ],
  },
  {
    id: 'eval-0040',
    modelVersion: 'v2.3.1',
    datasetVersion: 'rag-testset-v3.2',
    datasetSize: 240,
    trigger: 'push',
    status: 'success',
    gateResult: 'passed',
    passRate: 91.7,
    passed: 220,
    failed: 20,
    total: 240,
    durationSec: 312,
    startedAt: '2026-05-14T22:00:00Z',
    steps: [
      { name: 'data-load',       status: 'success', durationSec: 7   },
      { name: 'retrieval-test',  status: 'success', durationSec: 98  },
      { name: 'generation-test', status: 'success', durationSec: 187 },
      { name: 'report',          status: 'success', durationSec: 20  },
    ],
  },
  {
    id: 'eval-0039',
    modelVersion: 'v2.3.0',
    datasetVersion: 'rag-testset-v3.1',
    datasetSize: 200,
    trigger: 'push',
    status: 'failed',
    gateResult: 'blocked',
    passRate: 74.5,
    passed: 149,
    failed: 51,
    total: 200,
    durationSec: 298,
    startedAt: '2026-05-13T15:30:00Z',
    steps: [
      { name: 'data-load',       status: 'success', durationSec: 6   },
      { name: 'retrieval-test',  status: 'success', durationSec: 91  },
      { name: 'generation-test', status: 'failed',  durationSec: 181 },
      { name: 'report',          status: 'success', durationSec: 20  },
    ],
  },
  {
    id: 'eval-0038',
    modelVersion: 'v2.2.0',
    datasetVersion: 'rag-testset-v3.1',
    datasetSize: 200,
    trigger: 'schedule',
    status: 'success',
    gateResult: 'passed',
    passRate: 88.0,
    passed: 176,
    failed: 24,
    total: 200,
    durationSec: 289,
    startedAt: '2026-05-10T18:00:00Z',
    steps: [
      { name: 'data-load',       status: 'success', durationSec: 7   },
      { name: 'retrieval-test',  status: 'success', durationSec: 90  },
      { name: 'generation-test', status: 'success', durationSec: 172 },
      { name: 'report',          status: 'success', durationSec: 20  },
    ],
  },
]

export const evalVersionComparison: EvalVersionComparison[] = [
  { metric: 'Pass Rate',        current: 91.7,  previous: 88.0,  threshold: 85.0, higherIsBetter: true },
  { metric: 'Context Recall',   current: 0.874, previous: 0.851, threshold: 0.80, higherIsBetter: true },
  { metric: 'Context Precision',current: 0.812, previous: 0.798, threshold: 0.75, higherIsBetter: true },
  { metric: 'Faithfulness',     current: 0.903, previous: 0.881, threshold: 0.85, higherIsBetter: true },
  { metric: 'Answer Relevancy', current: 0.867, previous: 0.842, threshold: 0.80, higherIsBetter: true },
  { metric: 'RAGAS Score',      current: 0.864, previous: 0.843, threshold: 0.80, higherIsBetter: true },
]

export const evalAllCases: Record<string, EvalTestCase[]> = {
  'eval-0040': [
    { id: 'tc-001', category: '기술문서',    query: 'Kubernetes HPA 동작 원리',           status: 'passed', retrievalScore: 0.92, faithfulness: 0.94, answerRelevancy: 0.91 },
    { id: 'tc-002', category: '제품/서비스', query: '월 구독 플랜 해지 방법',              status: 'passed', retrievalScore: 0.88, faithfulness: 0.90, answerRelevancy: 0.87 },
    { id: 'tc-003', category: '내부정책',    query: '연차 신청 기한 규정',                 status: 'passed', retrievalScore: 0.85, faithfulness: 0.88, answerRelevancy: 0.86 },
    { id: 'tc-012', category: '법률/규정',   query: '개인정보보호법 17조 위반 시 과태료는?', status: 'failed', failureCategory: 'retrieval',  retrievalScore: 0.31, faithfulness: 0.72, answerRelevancy: 0.65 },
    { id: 'tc-047', category: '기술문서',    query: 'API rate limit 초과 시 재시도 전략',  status: 'failed', failureCategory: 'generation', retrievalScore: 0.88, faithfulness: 0.41, answerRelevancy: 0.52 },
    { id: 'tc-089', category: '법률/규정',   query: '전자서명법 제3조 적용 범위',           status: 'failed', failureCategory: 'retrieval',  retrievalScore: 0.28, faithfulness: 0.68, answerRelevancy: 0.60 },
    { id: 'tc-103', category: '내부정책',    query: '해외 출장 경비 정산 기한',             status: 'failed', failureCategory: 'both',       retrievalScore: 0.35, faithfulness: 0.38, answerRelevancy: 0.44 },
    { id: 'tc-156', category: '기술문서',    query: 'Redis 클러스터 failover 동작 방식',    status: 'failed', failureCategory: 'generation', retrievalScore: 0.91, faithfulness: 0.45, answerRelevancy: 0.58 },
    { id: 'tc-200', category: '제품/서비스', query: 'API 키 재발급 절차',                  status: 'passed', retrievalScore: 0.90, faithfulness: 0.93, answerRelevancy: 0.89 },
    { id: 'tc-201', category: '기술문서',    query: 'gRPC vs REST 선택 기준',              status: 'passed', retrievalScore: 0.87, faithfulness: 0.89, answerRelevancy: 0.85 },
  ],
  'eval-0039': [
    { id: 'tc-001', category: '기술문서',  query: 'Kubernetes HPA 동작 원리',             status: 'passed', retrievalScore: 0.83, faithfulness: 0.85, answerRelevancy: 0.82 },
    { id: 'tc-012', category: '법률/규정', query: '개인정보보호법 17조 위반 시 과태료는?', status: 'failed', failureCategory: 'retrieval',  retrievalScore: 0.28, faithfulness: 0.60, answerRelevancy: 0.55 },
    { id: 'tc-047', category: '기술문서',  query: 'API rate limit 초과 시 재시도 전략',   status: 'failed', failureCategory: 'generation', retrievalScore: 0.80, faithfulness: 0.35, answerRelevancy: 0.45 },
    { id: 'tc-089', category: '법률/규정', query: '전자서명법 제3조 적용 범위',            status: 'failed', failureCategory: 'both',       retrievalScore: 0.25, faithfulness: 0.30, answerRelevancy: 0.40 },
    { id: 'tc-200', category: '제품/서비스', query: 'API 키 재발급 절차',                  status: 'passed', retrievalScore: 0.81, faithfulness: 0.84, answerRelevancy: 0.80 },
  ],
}

export const evalDataset: EvalDataset = {
  name: 'rag-testset',
  version: 'v3.2',
  s3Path: 's3://llmops-artifacts/eval-datasets/rag-testset-v3.2/',
  totalCases: 240,
  categories: [
    { name: '법률/규정',   count: 72 },
    { name: '기술문서',    count: 80 },
    { name: '내부정책',    count: 56 },
    { name: '제품/서비스', count: 32 },
  ],
  lastUpdated: '2026-05-10T09:00:00Z',
}

export const ragDailyTrend = [
  { day: '5/11', passRate: 83, faithfulness: 84, contextRecall: 81, ragasScore: 82 },
  { day: '5/12', passRate: 88, faithfulness: 88, contextRecall: 85, ragasScore: 86 },
  { day: '5/13', passRate: 74, faithfulness: 77, contextRecall: 72, ragasScore: 75 },
  { day: '5/14', passRate: 92, faithfulness: 91, contextRecall: 88, ragasScore: 90 },
  { day: '5/15', passRate: 91, faithfulness: 90, contextRecall: 87, ragasScore: 86 },
]

export const ragRadarMetrics = [
  { metric: 'Faithfulness',      current: 90, previous: 88 },
  { metric: 'Answer Relevancy',  current: 87, previous: 84 },
  { metric: 'Context Precision', current: 81, previous: 80 },
  { metric: 'Context Recall',    current: 87, previous: 85 },
  { metric: 'RAGAS Score',       current: 86, previous: 84 },
]

export const ragHeatmapData: HeatmapCell[] = [
  { hour: '00:00', category: '법률/규정',   count: 2,  passRate: 50  },
  { hour: '00:00', category: '기술문서',    count: 4,  passRate: 75  },
  { hour: '00:00', category: '내부정책',    count: 1,  passRate: 100 },
  { hour: '00:00', category: '제품/서비스', count: 2,  passRate: 100 },
  { hour: '06:00', category: '법률/규정',   count: 8,  passRate: 75  },
  { hour: '06:00', category: '기술문서',    count: 12, passRate: 83  },
  { hour: '06:00', category: '내부정책',    count: 6,  passRate: 83  },
  { hour: '06:00', category: '제품/서비스', count: 4,  passRate: 100 },
  { hour: '09:00', category: '법률/규정',   count: 18, passRate: 72  },
  { hour: '09:00', category: '기술문서',    count: 22, passRate: 91  },
  { hour: '09:00', category: '내부정책',    count: 14, passRate: 86  },
  { hour: '09:00', category: '제품/서비스', count: 9,  passRate: 100 },
  { hour: '12:00', category: '법률/규정',   count: 24, passRate: 71  },
  { hour: '12:00', category: '기술문서',    count: 28, passRate: 89  },
  { hour: '12:00', category: '내부정책',    count: 18, passRate: 89  },
  { hour: '12:00', category: '제품/서비스', count: 12, passRate: 92  },
  { hour: '15:00', category: '법률/규정',   count: 20, passRate: 70  },
  { hour: '15:00', category: '기술문서',    count: 25, passRate: 88  },
  { hour: '15:00', category: '내부정책',    count: 15, passRate: 87  },
  { hour: '15:00', category: '제품/서비스', count: 10, passRate: 90  },
  { hour: '18:00', category: '법률/규정',   count: 14, passRate: 64  },
  { hour: '18:00', category: '기술문서',    count: 18, passRate: 83  },
  { hour: '18:00', category: '내부정책',    count: 10, passRate: 90  },
  { hour: '18:00', category: '제품/서비스', count: 7,  passRate: 86  },
  { hour: '21:00', category: '법률/규정',   count: 6,  passRate: 67  },
  { hour: '21:00', category: '기술문서',    count: 8,  passRate: 75  },
  { hour: '21:00', category: '내부정책',    count: 4,  passRate: 100 },
  { hour: '21:00', category: '제품/서비스', count: 3,  passRate: 100 },
]

export const ragClusterPoints: ClusterPoint[] = [
  { x: 0.92, y: 0.94, cluster: 'success'         },
  { x: 0.88, y: 0.90, cluster: 'success'         },
  { x: 0.85, y: 0.88, cluster: 'success'         },
  { x: 0.90, y: 0.93, cluster: 'success'         },
  { x: 0.87, y: 0.91, cluster: 'success'         },
  { x: 0.83, y: 0.87, cluster: 'success'         },
  { x: 0.91, y: 0.89, cluster: 'success'         },
  { x: 0.86, y: 0.92, cluster: 'success'         },
  { x: 0.89, y: 0.90, cluster: 'success'         },
  { x: 0.84, y: 0.86, cluster: 'success'         },
  { x: 0.93, y: 0.95, cluster: 'success'         },
  { x: 0.80, y: 0.84, cluster: 'success'         },
  { x: 0.88, y: 0.87, cluster: 'success'         },
  { x: 0.85, y: 0.91, cluster: 'success'         },
  { x: 0.90, y: 0.88, cluster: 'success'         },
  { x: 0.31, y: 0.72, cluster: 'retrieval-fail'  },
  { x: 0.28, y: 0.68, cluster: 'retrieval-fail'  },
  { x: 0.25, y: 0.71, cluster: 'retrieval-fail'  },
  { x: 0.33, y: 0.65, cluster: 'retrieval-fail'  },
  { x: 0.29, y: 0.74, cluster: 'retrieval-fail'  },
  { x: 0.27, y: 0.69, cluster: 'retrieval-fail'  },
  { x: 0.32, y: 0.70, cluster: 'retrieval-fail'  },
  { x: 0.88, y: 0.41, cluster: 'generation-fail' },
  { x: 0.91, y: 0.45, cluster: 'generation-fail' },
  { x: 0.85, y: 0.38, cluster: 'generation-fail' },
  { x: 0.87, y: 0.43, cluster: 'generation-fail' },
  { x: 0.89, y: 0.40, cluster: 'generation-fail' },
  { x: 0.86, y: 0.47, cluster: 'generation-fail' },
  { x: 0.35, y: 0.38, cluster: 'both-fail'       },
  { x: 0.37, y: 0.35, cluster: 'both-fail'       },
  { x: 0.33, y: 0.40, cluster: 'both-fail'       },
]

export const ragFlowData = [
  { category: '법률/규정',   통과: 56, 실패: 16 },
  { category: '기술문서',    통과: 72, 실패: 8  },
  { category: '내부정책',    통과: 52, 실패: 4  },
  { category: '제품/서비스', 통과: 30, 실패: 2  },
]

// ── RAG 버전별 지표 ───────────────────────────────────────────────────────────

export const ragVersions = ['v2.3.1', 'v2.3.0', 'v2.2.0', 'v2.1.5'] as const
export type RagVersion = typeof ragVersions[number]

export interface RagVersionKpi {
  passRate: number
  ragasScore: number
  contextRecall: number
  contextPrecision: number
  faithfulness: number
  answerRelevancy: number
  avgDurationSec: number
  costUsd: number
  dataset: string
  datasetSize: number
  gate: 'passed' | 'blocked'
}

export const ragVersionKpi: Record<RagVersion, RagVersionKpi> = {
  'v2.3.1': {
    passRate: 91.7, ragasScore: 0.864, contextRecall: 0.874, contextPrecision: 0.812,
    faithfulness: 0.903, answerRelevancy: 0.867, avgDurationSec: 312, costUsd: 3.24,
    dataset: 'rag-testset-v3.2', datasetSize: 240, gate: 'passed',
  },
  'v2.3.0': {
    passRate: 74.5, ragasScore: 0.761, contextRecall: 0.791, contextPrecision: 0.743,
    faithfulness: 0.782, answerRelevancy: 0.754, avgDurationSec: 298, costUsd: 2.81,
    dataset: 'rag-testset-v3.1', datasetSize: 200, gate: 'blocked',
  },
  'v2.2.0': {
    passRate: 88.0, ragasScore: 0.843, contextRecall: 0.851, contextPrecision: 0.798,
    faithfulness: 0.881, answerRelevancy: 0.842, avgDurationSec: 289, costUsd: 2.73,
    dataset: 'rag-testset-v3.1', datasetSize: 200, gate: 'passed',
  },
  'v2.1.5': {
    passRate: 83.2, ragasScore: 0.811, contextRecall: 0.822, contextPrecision: 0.771,
    faithfulness: 0.844, answerRelevancy: 0.809, avgDurationSec: 302, costUsd: 2.58,
    dataset: 'rag-testset-v3.0', datasetSize: 180, gate: 'passed',
  },
}

export const ragVersionRadar: Record<RagVersion, { metric: string; current: number; previous: number }[]> = {
  'v2.3.1': [
    { metric: 'Pass Rate',    current: 91.7, previous: 88.0 },
    { metric: 'C.Recall',     current: 87.4, previous: 85.1 },
    { metric: 'C.Precision',  current: 81.2, previous: 79.8 },
    { metric: 'Faithfulness', current: 90.3, previous: 88.1 },
    { metric: 'A.Relevancy',  current: 86.7, previous: 84.2 },
  ],
  'v2.3.0': [
    { metric: 'Pass Rate',    current: 74.5, previous: 88.0 },
    { metric: 'C.Recall',     current: 79.1, previous: 85.1 },
    { metric: 'C.Precision',  current: 74.3, previous: 79.8 },
    { metric: 'Faithfulness', current: 78.2, previous: 88.1 },
    { metric: 'A.Relevancy',  current: 75.4, previous: 84.2 },
  ],
  'v2.2.0': [
    { metric: 'Pass Rate',    current: 88.0, previous: 83.2 },
    { metric: 'C.Recall',     current: 85.1, previous: 82.2 },
    { metric: 'C.Precision',  current: 79.8, previous: 77.1 },
    { metric: 'Faithfulness', current: 88.1, previous: 84.4 },
    { metric: 'A.Relevancy',  current: 84.2, previous: 80.9 },
  ],
  'v2.1.5': [
    { metric: 'Pass Rate',    current: 83.2, previous: 79.0 },
    { metric: 'C.Recall',     current: 82.2, previous: 78.5 },
    { metric: 'C.Precision',  current: 77.1, previous: 74.0 },
    { metric: 'Faithfulness', current: 84.4, previous: 80.1 },
    { metric: 'A.Relevancy',  current: 80.9, previous: 77.3 },
  ],
}

export const ragVersionDailyTrend: Record<RagVersion, { day: string; passRate: number; faithfulness: number; ragasScore: number }[]> = {
  'v2.3.1': [
    { day: '05/11', passRate: 89.5, faithfulness: 88.1, ragasScore: 84.3 },
    { day: '05/12', passRate: 90.2, faithfulness: 88.9, ragasScore: 85.0 },
    { day: '05/13', passRate: 90.8, faithfulness: 89.5, ragasScore: 85.5 },
    { day: '05/14', passRate: 91.2, faithfulness: 90.1, ragasScore: 86.1 },
    { day: '05/15', passRate: 91.7, faithfulness: 90.3, ragasScore: 86.4 },
  ],
  'v2.3.0': [
    { day: '05/09', passRate: 72.0, faithfulness: 76.5, ragasScore: 74.2 },
    { day: '05/10', passRate: 73.1, faithfulness: 77.2, ragasScore: 75.0 },
    { day: '05/11', passRate: 73.8, faithfulness: 77.8, ragasScore: 75.5 },
    { day: '05/12', passRate: 74.2, faithfulness: 78.0, ragasScore: 76.0 },
    { day: '05/13', passRate: 74.5, faithfulness: 78.2, ragasScore: 76.1 },
  ],
  'v2.2.0': [
    { day: '05/06', passRate: 85.5, faithfulness: 86.0, ragasScore: 82.1 },
    { day: '05/07', passRate: 86.2, faithfulness: 86.8, ragasScore: 82.9 },
    { day: '05/08', passRate: 87.0, faithfulness: 87.5, ragasScore: 83.5 },
    { day: '05/09', passRate: 87.5, faithfulness: 88.0, ragasScore: 84.0 },
    { day: '05/10', passRate: 88.0, faithfulness: 88.1, ragasScore: 84.3 },
  ],
  'v2.1.5': [
    { day: '04/28', passRate: 81.0, faithfulness: 82.5, ragasScore: 79.0 },
    { day: '04/29', passRate: 81.8, faithfulness: 83.2, ragasScore: 79.8 },
    { day: '04/30', passRate: 82.3, faithfulness: 83.8, ragasScore: 80.5 },
    { day: '05/01', passRate: 82.8, faithfulness: 84.2, ragasScore: 81.0 },
    { day: '05/02', passRate: 83.2, faithfulness: 84.4, ragasScore: 81.1 },
  ],
}

// InferenceService 모니터링 mock 데이터
export const inferenceServices = ['tei-embed-test', 'tei-embed-prod', 'tei-embed-staging']

export interface InferenceServicePodStatus {
  desired: number
  ready: number
  available: number
}

export const inferenceServicePodStatus: Record<string, InferenceServicePodStatus> = {
  'tei-embed-test':    { desired: 1, ready: 1, available: 1 },
  'tei-embed-prod':    { desired: 3, ready: 3, available: 3 },
  'tei-embed-staging': { desired: 1, ready: 1, available: 1 },
}

export const inferenceServiceQueueSize: Record<string, number> = {
  'tei-embed-test':    0,
  'tei-embed-prod':    2,
  'tei-embed-staging': 0,
}

export const inferenceService429Rate: Record<string, number | null> = {
  'tei-embed-test':    null,
  'tei-embed-prod':    0.12,
  'tei-embed-staging': null,
}

const TIMES = ['05:00','05:30','06:00','06:30','07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30']

export const inferenceQueueSizeHistory = TIMES.map((time, i) => ({
  time,
  queueSize: [0,0,1,0,0,2,1,0,0,0,1,0][i],
}))

export const inferenceQueueLatencyHistory = TIMES.map((time, i) => ({
  time,
  p50: [0,0,12,0,0,18,14,0,0,0,10,0][i],
  p95: [0,0,28,0,0,42,31,0,0,0,23,0][i],
  p99: [0,0,55,0,0,80,60,0,0,0,45,0][i],
}))

export const inferenceRpsHistory = TIMES.map((time, i) => ({
  time,
  rps: [0.05,0.08,0.13,0.10,0.09,0.15,0.13,0.11,0.09,0.10,0.13,0.08][i],
}))

export const inferenceHttpStatusRpsHistory = TIMES.map((time, i) => ({
  time,
  s200: [0.05,0.08,0.13,0.10,0.09,0.13,0.13,0.11,0.09,0.10,0.13,0.08][i],
  s404: [0,0,0,0,0,0,0,0,0,0,0,0][i],
  s503: [0,0,0,0,0,0.02,0,0,0,0,0,0][i],
}))
