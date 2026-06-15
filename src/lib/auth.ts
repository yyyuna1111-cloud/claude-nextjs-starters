import { verifyUser, findUser, getUsers } from './user-store'
import { COOKIE_NAME, SESSION_MAX_AGE } from './auth-constants'

export { COOKIE_NAME, SESSION_MAX_AGE }

export function isAdminUser(username: string): boolean {
  const user = findUser(username)
  return user?.isAdmin ?? false
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET 환경변수가 설정되지 않았습니다')
  }
  return secret ?? 'dev-secret-change-this-in-production'
}

export function verifyCredentials(username: string, password: string): boolean {
  return verifyUser(username, password)
}

export function listUsernames(): string[] {
  return getUsers().map(u => u.username)
}

import { getHmacKey, toBase64url } from './auth-edge'
export { verifySessionToken, verifySessionTokenFull } from './auth-edge'

export async function createSessionToken(username: string): Promise<string> {
  const user = findUser(username)
  const payload = JSON.stringify({ 
    u: username, 
    iat: Math.floor(Date.now() / 1000),
    m: user?.accessibleMenus ?? [],
    a: user?.isAdmin ?? false
  })
  const encoded = toBase64url(new TextEncoder().encode(payload).buffer as ArrayBuffer)
  const key = await getHmacKey()
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded).buffer as ArrayBuffer)
  return `${encoded}.${toBase64url(sig)}`
}
