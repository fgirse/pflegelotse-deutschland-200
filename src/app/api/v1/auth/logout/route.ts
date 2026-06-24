import { NextResponse } from 'next/server'
import { COOKIE_2FA } from '@/server/auth/twofactor'

export const dynamic = 'force-dynamic'

// POST /api/v1/auth/logout — beendet die Sitzung (beide Cookies löschen).
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set('payload-token', '', { path: '/', maxAge: 0 })
  res.cookies.set(COOKIE_2FA, '', { path: '/', maxAge: 0 })
  return res
}
