import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { payloadClient } from '@/server/payloadClient'
import { getAuthUser } from '@/server/auth/guard'
import { ladeTotpSecret } from '@/server/auth/totpStore'
import { verifyTotp } from '@/lib/totp'
import { COOKIE_2FA, sign2fa, TWOFA_TTL_MS } from '@/server/auth/twofactor'

export const dynamic = 'force-dynamic'

// POST /api/v1/auth/2fa/activate {code} — bestätigt das eingerichtete Secret
// mit dem ersten Code, aktiviert 2FA und setzt das 2FA-Session-Cookie.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req.headers)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const parsed = z.object({ code: z.string().min(6) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Code fehlt' }, { status: 400 })

  const totp = await ladeTotpSecret(user.id)
  if (!totp?.secret) return NextResponse.json({ error: 'Kein Secret eingerichtet' }, { status: 400 })
  if (!verifyTotp(totp.secret, parsed.data.code)) {
    return NextResponse.json({ error: 'Code ungültig' }, { status: 400 })
  }

  const payload = await payloadClient()
  await payload.update({
    collection: 'users',
    id: user.id,
    data: { totpEnabled: true },
    overrideAccess: true,
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_2FA, sign2fa(user.id), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TWOFA_TTL_MS / 1000,
  })
  return res
}
