// 업그레이드 경로: 현재 평문 비교 → 이후 bcrypt 해시로 교체 가능
// USER_PASSWORDS 형식: "alice:pass1,bob:pass2"

export const COOKIE_NAME = 'mlops_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7일 (초)

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET 환경변수가 설정되지 않았습니다')
  }
  return secret ?? 'dev-secret-change-this-in-production'
}

function getUsers(): Record<string, string> {
  const raw = process.env.USER_PASSWORDS ?? ''
  const users: Record<string, string> = {}
  for (const entry of raw.split(',')) {
    const colon = entry.indexOf(':')
    if (colon === -1) continue
    const username = entry.slice(0, colon).trim()
    const password = entry.slice(colon + 1).trim()
    if (username && password) users[username] = password
  }
  return users
}

export function verifyCredentials(username: string, password: string): boolean {
  const users = getUsers()
  return Object.prototype.hasOwnProperty.call(users, username) && users[username] === password
}

export function listUsernames(): string[] {
  return Object.keys(getUsers())
}

async function getHmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

function toBase64url(buf: ArrayBuffer): string {
  return btoa(Array.from(new Uint8Array(buf), b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromBase64url(str: string): ArrayBuffer {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = atob(b64).split('').map(c => c.charCodeAt(0))
  return new Uint8Array(bytes).buffer
}

export async function createSessionToken(username: string): Promise<string> {
  const payload = JSON.stringify({ u: username, iat: Math.floor(Date.now() / 1000) })
  const encoded = toBase64url(new TextEncoder().encode(payload).buffer as ArrayBuffer)
  const key = await getHmacKey()
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded).buffer as ArrayBuffer)
  return `${encoded}.${toBase64url(sig)}`
}

export async function verifySessionToken(token: string): Promise<string | null> {
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
    const { u, iat } = JSON.parse(new TextDecoder().decode(fromBase64url(encoded)))
    if (Math.floor(Date.now() / 1000) - iat > SESSION_MAX_AGE) return null
    return u as string
  } catch {
    return null
  }
}
