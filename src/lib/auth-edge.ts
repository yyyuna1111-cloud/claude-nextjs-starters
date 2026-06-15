import { COOKIE_NAME, SESSION_MAX_AGE } from './auth-constants'

export interface SessionPayload {
  u: string
  iat: number
  m: string[] // accessibleMenus
  a: boolean  // isAdmin
}

export function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  // Edge 런타임에서 process.env.AUTH_SECRET을 못 읽을 경우를 대비해 configmap과 동일한 하드코딩 폴백 추가
  return secret || 'mlops-dashboard-secret-2026'
}

export async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export function toBase64url(buf: ArrayBuffer): string {
  return btoa(Array.from(new Uint8Array(buf), b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function fromBase64url(str: string): ArrayBuffer {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const bytes = atob(b64).split('').map(c => c.charCodeAt(0))
  return new Uint8Array(bytes).buffer
}

export async function verifySessionTokenFull(token: string): Promise<SessionPayload | null> {
  try {
    const dot = token.lastIndexOf('.')
    if (dot === -1) return null
    const encoded = token.slice(0, dot)
    const sigStr = token.slice(dot + 1)
    const key = await getHmacKey()
    const valid = await crypto.subtle.verify(
      'HMAC', key, fromBase64url(sigStr), new TextEncoder().encode(encoded).buffer as ArrayBuffer
    )
    if (!valid) return null
    
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(encoded))) as SessionPayload
    if (Math.floor(Date.now() / 1000) - payload.iat > SESSION_MAX_AGE) return null
    
    // 이전 버전의 토큰(m, a 필드가 없는 경우)은 무효화하여 재로그인 유도
    if (payload.m === undefined || payload.a === undefined) return null

    return payload
  } catch {
    return null
  }
}

export async function verifySessionToken(token: string): Promise<string | null> {
  const payload = await verifySessionTokenFull(token)
  return payload ? payload.u : null
}
