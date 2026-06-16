import { COOKIE_NAME, SESSION_MAX_AGE } from './auth-constants'

export interface SessionPayload {
  u: string
  iat: number
  m: string[] // accessibleMenus
  a: boolean  // isAdmin
}

export function getSecret(): string {
  const secret = process.env.AUTH_SECRET
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

export function toBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function fromBase64url(str: string): ArrayBuffer {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer as ArrayBuffer
}

function strToBuffer(str: string): ArrayBuffer {
  const u8 = new TextEncoder().encode(str)
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}

export async function verifySessionTokenFull(token: string): Promise<SessionPayload | null> {
  try {
    const dot = token.lastIndexOf('.')
    if (dot === -1) return null
    const encoded = token.slice(0, dot)
    const sigStr = token.slice(dot + 1)
    const key = await getHmacKey()
    const valid = await crypto.subtle.verify(
      'HMAC', key, fromBase64url(sigStr), strToBuffer(encoded)
    )
    if (!valid) return null

    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(encoded))) as SessionPayload
    if (Math.floor(Date.now() / 1000) - payload.iat > SESSION_MAX_AGE) return null

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
