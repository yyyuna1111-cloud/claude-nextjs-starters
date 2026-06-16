import { verifyUser, findUser, getUsers } from './user-store'
import { COOKIE_NAME, SESSION_MAX_AGE } from './auth-constants'

export { COOKIE_NAME, SESSION_MAX_AGE }

export function isAdminUser(username: string): boolean {
  const user = findUser(username)
  return user?.isAdmin ?? false
}

export function verifyCredentials(username: string, password: string): boolean {
  return verifyUser(username, password)
}

export function listUsernames(): string[] {
  return getUsers().map(u => u.username)
}

import { getHmacKey, toBase64url } from './auth-edge'
export { verifySessionToken, verifySessionTokenFull } from './auth-edge'

function strToBuffer(str: string): ArrayBuffer {
  const u8 = new TextEncoder().encode(str)
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}

export async function createSessionToken(username: string): Promise<string> {
  const user = findUser(username)
  const payload = JSON.stringify({
    u: username,
    iat: Math.floor(Date.now() / 1000),
    m: user?.accessibleMenus ?? [],
    a: user?.isAdmin ?? false
  })
  const encoded = toBase64url(new Uint8Array(strToBuffer(payload)))
  const key = await getHmacKey()
  const sig = await crypto.subtle.sign('HMAC', key, strToBuffer(encoded))
  return `${encoded}.${toBase64url(new Uint8Array(sig))}`
}
