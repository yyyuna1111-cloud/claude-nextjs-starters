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
  K8S_DEV_API_URL: z.string().url().default('https://10.70.171.187:6443'),
  K8S_DEV_TOKEN: z.string().min(1).default('eyJhbGciOiJSUzI1NiIsImtpZCI6InZpX211bmNDYWExSlF0NFFPM0VMc3lkd1Y0VUdlNmc5dzU1NUZKV0tEaWsifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJtb2RlbC1zZXJ2aW5nIiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZWNyZXQubmFtZSI6Im1vZGVsLWh1YiIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50Lm5hbWUiOiJtb2RlbC1odWIiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50Iiwic2VydmljZS1hY2NvdW50LnVpZCI6IjAyYzY0YzA3LTNkMDMtNGYwMi1hMTNhLThmNTAxOWJhYzlkYmkiLCJzdWIiOiJzeXN0ZW06c2VydmljZWFjY291bnQ6bW9kZWwtc2VydmluZzptb2RlbC1odWIifQ.Mt-K1DlQxqcyCWNmlnJROnyR1j4xwwZPYixUeHzNksRWnTVqVzRQGhvAxVtboGjr7FFFZGOejY91vnVL5bXwqrAt4D-SCoa9UweZaHhGTZckKhAiM6k2hoS4oaCsE-D8pmdWPpp_2jUQcNa58e6ivKHIPOpmyvQ0MQiWvXEAQXeKClalXMNoHy3rrrI9ACbZNy_nYFGdG0sfA71me2-VVIbckDmX_Oc-BW7Qn41tvqZxJLzbPwaRei3g9iMBJkoKyETq8_lkcIKyhY3GlKrFPG-rU0wlojUzznOQSkuDY_0Jc4-m2jYN64WNccPJUyDdodDpKQOl6db4l8SAav44lQ'),

  // OPS 환경 설정 (나중에 실 IP/Token으로 교체)
  K8S_OPS_API_URL: z.string().url().default('https://0.0.0.0:6443'),
  K8S_OPS_TOKEN: z.string().optional().default('OPS_TOKEN_PLACEHOLDER'),
})

const parsedEnv = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_URL: process.env.VERCEL_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  TARGET_ENV: process.env.TARGET_ENV,
  K8S_DEV_API_URL: process.env.K8S_DEV_API_URL,
  K8S_DEV_TOKEN: process.env.K8S_DEV_TOKEN,
  K8S_OPS_API_URL: process.env.K8S_OPS_API_URL,
  K8S_OPS_TOKEN: process.env.K8S_OPS_TOKEN,
})

// 환경에 따른 현재 설정값 도출 (Helper)
const currentK8sConfig = parsedEnv.TARGET_ENV === 'DEV' 
  ? { url: parsedEnv.K8S_DEV_API_URL, token: parsedEnv.K8S_DEV_TOKEN }
  : { url: parsedEnv.K8S_OPS_API_URL, token: parsedEnv.K8S_OPS_TOKEN };

export const env = {
  ...parsedEnv,
  K8S_API_URL: currentK8sConfig.url,
  K8S_TOKEN: currentK8sConfig.token as string,
}

export type Env = z.infer<typeof envSchema>
