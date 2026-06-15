import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export interface User {
  username: string
  hash: string
  salt: string
  isAdmin: boolean
  accessibleMenus: string[]
}

const STORE_PATH = process.env.NODE_ENV === 'production' 
  ? '/mnt/sllm/config/users.json' 
  : path.join(process.cwd(), 'users.json')

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex')
}

function ensureStoreDir() {
  const dir = path.dirname(STORE_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function getUsers(): User[] {
  if (!fs.existsSync(STORE_PATH)) {
    // 마이그레이션: 기존 환경변수가 있으면 그걸로 초기화
    migrateFromEnv()
  }
  
  try {
    const data = fs.readFileSync(STORE_PATH, 'utf-8')
    return JSON.parse(data)
  } catch (err) {
    console.error('Failed to read users.json', err)
    return []
  }
}

export function saveUsers(users: User[]) {
  ensureStoreDir()
  fs.writeFileSync(STORE_PATH, JSON.stringify(users, null, 2))
}

function migrateFromEnv() {
  const raw = process.env.USER_PASSWORDS ?? ''
  const ADMIN_USERS = ['seungyeon2', 'yun4703', 'ynlee0804']
  const users: User[] = []
  
  // 기본 모든 메뉴 접근 권한 (마이그레이션 용)
  const allMenus = [
    '/dashboard', '/dashboard/serving', '/dashboard/llm', 
    '/dashboard/deployments', '/dashboard/evaluation', 
    '/dashboard/scraping', '/dashboard/infrastructure', 
    '/dashboard/storage', '/dashboard/jupyter', '/dashboard/registry'
  ]

  for (const entry of raw.split(',')) {
    const colon = entry.indexOf(':')
    if (colon === -1) continue
    const username = entry.slice(0, colon).trim()
    const password = entry.slice(colon + 1).trim()
    if (username && password) {
      const salt = generateSalt()
      const hash = hashPassword(password, salt)
      users.push({
        username,
        hash,
        salt,
        isAdmin: ADMIN_USERS.includes(username),
        accessibleMenus: allMenus
      })
    }
  }

  // 만약 비어있다면 기본 관리자 계정 하나 생성
  if (users.length === 0) {
    const salt = generateSalt()
    users.push({
      username: 'admin',
      hash: hashPassword('admin', salt),
      salt,
      isAdmin: true,
      accessibleMenus: allMenus
    })
  }

  saveUsers(users)
}

export function findUser(username: string): User | undefined {
  return getUsers().find(u => u.username === username)
}

export function verifyUser(username: string, password: string): boolean {
  const user = findUser(username)
  if (!user) return false
  const hash = hashPassword(password, user.salt)
  return hash === user.hash
}
