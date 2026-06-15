import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth-constants'
import { verifySessionTokenFull } from '@/lib/auth-edge'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  const payload = await verifySessionTokenFull(token)
  if (!payload) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin 페이지 보호
  if (request.nextUrl.pathname.startsWith('/dashboard/admin') && !payload.a) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 메뉴 접근 권한 확인 (dashboard 메인 제외)
  const pathname = request.nextUrl.pathname
  if (pathname !== '/dashboard' && pathname.startsWith('/dashboard/')) {
    // pathname에 해당하는 상위 메뉴 찾기
    const matchingMenu = payload.m.find(menu => pathname.startsWith(menu))
    
    // 만약 허용된 메뉴 목록에 매칭되는게 없고 (관리자도 아닌 경우)
    if (!matchingMenu && !payload.a) {
      // 권한이 없으면 메인 대시보드로 이동
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
