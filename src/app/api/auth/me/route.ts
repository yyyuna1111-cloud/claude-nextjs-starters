import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth'
import { findUser } from '@/lib/user-store'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const username = await verifySessionToken(token)
  if (!username) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = findUser(username)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ username, isAdmin: user.isAdmin, accessibleMenus: user.accessibleMenus })
}
