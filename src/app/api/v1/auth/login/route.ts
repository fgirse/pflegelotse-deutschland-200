import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { payloadClient } from '@/server/payloadClient'

export const dynamic = 'force-dynamic'

const schema = z.object({ email: z.string().email(), password: z.string().min(1) })

// POST /api/v1/auth/login — Passwort-Login (erster Faktor). Setzt das
// Payload-Session-Cookie. 2FA ist der zweite, separate Schritt.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const payload = await payloadClient()
  try {
    const { token, user, exp } = await payload.login({
      collection: 'users',
      data: { email: parsed.data.email, password: parsed.data.password },
    })
    const totpEnabled = Boolean((user as { totpEnabled?: boolean }).totpEnabled)
    const res = NextResponse.json({
      role: (user as { role?: string }).role,
      totpEnabled,
      // Solange 2FA nicht eingerichtet/bestätigt ist, sind geschützte Routen gesperrt.
      twoFactorRequired: totpEnabled,
      needsEnrollment: !totpEnabled,
    })
    if (token) {
      res.cookies.set('payload-token', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        ...(exp ? { expires: new Date(exp * 1000) } : {}),
      })
    }
    return res
  } catch {
    return NextResponse.json({ error: 'Anmeldung fehlgeschlagen' }, { status: 401 })
  }
}
