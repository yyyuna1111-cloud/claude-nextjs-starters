import { NextRequest, NextResponse } from 'next/server'
import { verifyCredentials, createSessionToken, COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력하세요' }, { status: 400 })
    }

    if (!verifyCredentials(username, password)) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' }, { status: 401 })
    }

    const token = await createSessionToken(username)
    const response = NextResponse.json({ ok: true, username })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
      secure: process.env.COOKIE_SECURE === 'true',
    })
    return response
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
