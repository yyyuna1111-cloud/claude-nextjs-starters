import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

export async function GET() {
  return NextResponse.redirect(`${env.JUPYTERHUB_URL}/hub/logout`)
}
