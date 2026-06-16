import { SignJWT } from 'jose'
import { verifyUser, findUser, getUsers } from './user-store'
import { COOKIE_NAME, SESSION_MAX_AGE } from './auth-constants'
import { getSecret } from './auth-edge'

export { COOKIE_NAME, SESSION_MAX_AGE }
export { verifySessionToken, verifySessionTokenFull } from './auth-edge'

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

export async function createSessionToken(username: string): Promise<string> {
  const user = findUser(username)
  return new SignJWT({
    u: username,
    m: user?.accessibleMenus ?? [],
    a: user?.isAdmin ?? false,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(getSecret())
}
