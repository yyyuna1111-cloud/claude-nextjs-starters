import { NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

const KFP_API        = process.env.KFP_API              ?? 'http://localhost:32424/apis/v2beta1'
const S3_ENDPOINT    = process.env.SEAWEEDFS_ENDPOINT   ?? 'http://localhost:30400'
const S3_ACCESS_KEY  = process.env.SEAWEEDFS_ACCESS_KEY ?? 'admin'
const S3_SECRET_KEY  = process.env.SEAWEEDFS_SECRET_KEY ?? 'skyadmin'
const S3_BUCKET      = process.env.SEAWEEDFS_BUCKET     ?? 'mlpipeline'
const EXPERIMENT_NAME = 'rag-quality-gate'

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  forcePathStyle: true,
})

async function fetchMetrics(
  rcVersion: string,
  datasetName: string,
  datasetVersion: string,
): Promise<Record<string, number> | null> {
  const key = `eval-metrics/${rcVersion}/${datasetName}-${datasetVersion}/metrics.json`
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }))
    const body = await res.Body?.transformToString()
    if (!body) return null
    return JSON.parse(body) as Record<string, number>
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const expRes = await fetch(`${KFP_API}/experiments`, { cache: 'no-store' })
    const expData = await expRes.json()
    const exp = (expData.experiments ?? []).find(
      (e: { display_name: string }) => e.display_name === EXPERIMENT_NAME
    )
    if (!exp) return NextResponse.json({ runs: [] })

    const runsRes = await fetch(
      `${KFP_API}/runs?experiment_id=${exp.experiment_id}&sort_by=created_at%20desc`,
      { cache: 'no-store' }
    )
    const runsData = await runsRes.json()
    const runs = (runsData.runs ?? []) as Array<{ run_id: string }>

    const detailed = await Promise.all(
      runs.map((r) =>
        fetch(`${KFP_API}/runs/${r.run_id}`, { cache: 'no-store' }).then((res) => res.json())
      )
    )

    const formatted = await Promise.all(
      detailed.map(async (run) => {
        const params = (run.runtime_config?.parameters ?? {}) as Record<string, unknown>
        const rcVersion      = String(params.rc_version ?? '-')
        const datasetName    = String(params.dataset_name ?? '-')
        const datasetVersion = String(params.dataset_version ?? '-')
        const status         = String(run.state ?? 'UNKNOWN')

        const metrics = status === 'SUCCEEDED'
          ? await fetchMetrics(rcVersion, datasetName, datasetVersion)
          : null

        return {
          runId:         run.run_id as string,
          displayName:   run.display_name as string,
          rcVersion,
          datasetName,
          datasetVersion,
          questionCount: Number(params.question_count ?? 0),
          status,
          createdAt:     String(run.created_at ?? ''),
          finishedAt:    String(run.finished_at ?? ''),
          metrics,
        }
      })
    )

    return NextResponse.json({ runs: formatted })
  } catch (e) {
    return NextResponse.json({ error: String(e), runs: [] }, { status: 500 })
  }
}
