import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser } from '@/server/auth/guard'
import { COOKIE_2FA, verify2fa } from '@/server/auth/twofactor'

export const dynamic = 'force-dynamic'

// GET /api/v1/auth/me — Sitzungsstatus für die UI (Login-/2FA-Zustand).
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req.headers)
  if (!user) return NextResponse.json({ user: null })
  const twofaActive = verify2fa(req.cookies.get(COOKIE_2FA)?.value, user.id)
  return NextResponse.json({
    user: { email: user.email, role: user.role, tenantId: user.tenantId, totpEnabled: user.totpEnabled },
    twofaActive,
  })
}
