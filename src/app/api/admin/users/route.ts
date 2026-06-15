import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, COOKIE_NAME, isAdminUser } from '@/lib/auth'
import { getUsers, saveUsers, hashPassword, generateSalt } from '@/lib/user-store'

// 인증 체크 미들웨어성 함수
async function verifyAdmin(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  const username = await verifySessionToken(token)
  if (!username || !isAdminUser(username)) return null
  return username
}

export async function GET(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const users = getUsers().map(({ hash, salt, ...rest }) => rest) // 비밀번호 해시와 솔트는 숨김
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    const { username, password, isAdmin, accessibleMenus } = await request.json()
    if (!username || !password) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const users = getUsers()
    if (users.some(u => u.username === username)) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 })
    }

    const salt = generateSalt()
    users.push({
      username,
      hash: hashPassword(password, salt),
      salt,
      isAdmin: isAdmin ?? false,
      accessibleMenus: accessibleMenus ?? []
    })

    saveUsers(users)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    const { username, password, isAdmin, accessibleMenus } = await request.json()
    if (!username) return NextResponse.json({ error: 'Missing username' }, { status: 400 })

    const users = getUsers()
    const userIndex = users.findIndex(u => u.username === username)
    if (userIndex === -1) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const user = users[userIndex]
    
    // 비밀번호가 제공되면 업데이트, 아니면 기존 유지
    if (password) {
      user.salt = generateSalt()
      user.hash = hashPassword(password, user.salt)
    }
    
    if (isAdmin !== undefined) user.isAdmin = isAdmin
    if (accessibleMenus !== undefined) user.accessibleMenus = accessibleMenus

    saveUsers(users)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!await verifyAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    if (!username) return NextResponse.json({ error: 'Missing username' }, { status: 400 })

    const users = getUsers()
    const filtered = users.filter(u => u.username !== username)
    if (users.length === filtered.length) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    saveUsers(filtered)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
