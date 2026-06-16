import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth-constants'
import { verifySessionTokenFull } from '@/lib/auth-edge'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /dashboard/* 직접 접근 시 /workspace/*로 브라우저 리다이렉트
  if (pathname.startsWith('/dashboard')) {
    const newPath = pathname.replace('/dashboard', '/workspace')
    const redirectUrl = new URL(newPath, request.url)
    redirectUrl.search = request.nextUrl.search
    return NextResponse.redirect(redirectUrl)
  }

  // /workspace/* 인증 확인
  const token = request.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const payload = await verifySessionTokenFull(token)
  if (!payload) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin 페이지 보호
  if (pathname.startsWith('/workspace/admin') && !payload.a) {
    return NextResponse.redirect(new URL('/workspace/storage', request.url))
  }

  // 메뉴 접근 권한 확인
  if (pathname !== '/workspace' && pathname.startsWith('/workspace/')) {
    const normalizedPathname = pathname.replace('/workspace/', '/dashboard/')
    const matchingMenu = payload.m.find(
      menu => pathname.startsWith(menu) || normalizedPathname.startsWith(menu)
    )
    if (!matchingMenu && !payload.a) {
      return NextResponse.redirect(new URL('/workspace/storage', request.url))
    }
  }

  // /workspace/* → /dashboard/* 내부 rewrite (브라우저 URL 유지)
  const rewriteUrl = new URL(request.url)
  rewriteUrl.pathname = pathname.replace('/workspace', '/dashboard')
  return NextResponse.rewrite(rewriteUrl)
}

export const config = {
  matcher: ['/dashboard/:path*', '/workspace/:path*'],
}
