import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  VERCEL_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  // 현재 조회 환경 (DEV | OPS)
  TARGET_ENV: z.enum(['DEV', 'OPS']).default('DEV'),

  // DEV 환경 설정
  K8S_DEV_API_URL: z.string().url().default('https://10.70.171.177:6443'),
  K8S_DEV_TOKEN: z.string().min(1).default('eyJhbGciOiJSUzI1NiIsImtpZCI6IlpRNlhnZ3lXa09USFhIdUR4YnJwRm5OZ0ZJOFJZXzh5UHA1T21RaGxhSFkifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJrdWJlLXN5c3RlbSIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VjcmV0Lm5hbWUiOiJ3aWRlLWFwaS1zZWNyZXQiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L3NlcnZpY2UtYWNjb3VudC5uYW1lIjoid2lkZS1hcGkiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L3NlcnZpY2UtYWNjb3VudC51aWQiOiIwYjllNWQzYS1lMzE4LTQ1NzgtODYzMS1lMzJhNjNkMjk2NzIiLCJzdWIiOiJzeXN0ZW06c2VydmljZWFjY291bnQ6a3ViZS1zeXN0ZW06d2lkZS1hcGkifQ.GR7cjI2O3ZcehTGOxvYm_fgTxxrzi_FRmszgvkupwgY8pogMCKWqA6kBkdAdohzKLTSjhEQHNPtm2Br0cNK7gd4lFmo0Hn4skcyinXlfnl9znunH89YDWwW12f6otaZSmG0WsJpDPxYqU2L44mEAOSH-kQfm2Mz1YYcuXGmCX2ekTGpQAi6qgCMYD2dPyAHC0dnQrCyWPGs7aPafIXvK09USieplP0JKSRlUn2Hpf0Ha9-_zFn1I4cIu7MjTw5RgIluFR4wttzK_gdPzni8bl48RYdTWQUe6ROvH8-iiGzCURo8JPNGE5mLKaMLhjPTs0vCzQ24_TNMoSnK3z-Xg_w'),
  K8S_DEV_DISPLAY_IP: z.string().default('10.70.171.187'),

  // OPS 환경 설정 (나중에 실 IP/Token으로 교체)
  K8S_OPS_API_URL: z.string().url().default('https://0.0.0.0:6443'),
  K8S_OPS_TOKEN: z.string().optional().default('OPS_TOKEN_PLACEHOLDER'),
  K8S_OPS_DISPLAY_IP: z.string().default('0.0.0.0'),

  // 보안 설정
  K8S_SKIP_TLS_VERIFY: z.string().default('true'),
})

const parsedEnv = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_URL: process.env.VERCEL_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  TARGET_ENV: process.env.TARGET_ENV,
  K8S_DEV_API_URL: process.env.K8S_DEV_API_URL,
  K8S_DEV_TOKEN: process.env.K8S_DEV_TOKEN,
  K8S_DEV_DISPLAY_IP: process.env.K8S_DEV_DISPLAY_IP,
  K8S_OPS_API_URL: process.env.K8S_OPS_API_URL,
  K8S_OPS_TOKEN: process.env.K8S_OPS_TOKEN,
  K8S_OPS_DISPLAY_IP: process.env.K8S_OPS_DISPLAY_IP,
  K8S_SKIP_TLS_VERIFY: process.env.K8S_SKIP_TLS_VERIFY,
})

// 환경에 따른 현재 설정값 도출 (Helper)
const currentK8sConfig = parsedEnv.TARGET_ENV === 'DEV' 
  ? { 
      url: parsedEnv.K8S_DEV_API_URL, 
      token: parsedEnv.K8S_DEV_TOKEN,
      displayIp: parsedEnv.K8S_DEV_DISPLAY_IP
    }
  : { 
      url: parsedEnv.K8S_OPS_API_URL, 
      token: parsedEnv.K8S_OPS_TOKEN,
      displayIp: parsedEnv.K8S_OPS_DISPLAY_IP
    };

export const env = {
  ...parsedEnv,
  K8S_API_URL: currentK8sConfig.url,
  K8S_TOKEN: currentK8sConfig.token as string,
  K8S_DISPLAY_IP: currentK8sConfig.displayIp,
}

export type Env = z.infer<typeof envSchema>
