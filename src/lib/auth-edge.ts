import { jwtVerify } from 'jose'
import { SESSION_MAX_AGE } from './auth-constants'

export interface SessionPayload {
  u: string
  iat: number
  m: string[]
  a: boolean
}

export function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || 'mlops-dashboard-secret-2026'
  return new TextEncoder().encode(secret)
}

export async function verifySessionTokenFull(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
      clockTolerance: 60,
    })
    const p = payload as Record<string, unknown>
    if (typeof p.u !== 'string') return null
    if (!Array.isArray(p.m)) return null
    if (typeof p.a !== 'boolean') return null
    const iat = typeof p.iat === 'number' ? p.iat : 0
    if (Math.floor(Date.now() / 1000) - iat > SESSION_MAX_AGE) return null
    return { u: p.u, iat, m: p.m as string[], a: p.a }
  } catch {
    return null
  }
}

export async function verifySessionToken(token: string): Promise<string | null> {
  const payload = await verifySessionTokenFull(token)
  return payload ? payload.u : null
}
