import { COOKIE_NAME, SESSION_MAX_AGE } from './auth-constants'

export interface SessionPayload {
  u: string
  iat: number
  m: string[] // accessibleMenus
  a: boolean  // isAdmin
}

export function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET 환경변수가 설정되지 않았습니다')
  }
  return secret ?? 'dev-secret-change-this-in-production'
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
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
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
    
    return payload
  } catch {
    return null
  }
}

export async function verifySessionToken(token: string): Promise<string | null> {
  const payload = await verifySessionTokenFull(token)
  return payload ? payload.u : null
}
