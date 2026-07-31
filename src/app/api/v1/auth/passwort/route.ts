import { NextResponse, type NextRequest } from 'next/server'
import { payloadClient } from '@/server/payloadClient'
import { getAuthUser } from '@/server/auth/guard'
import { passwortAendernSchema } from '@/shared/passwort'

export const dynamic = 'force-dynamic'

// POST /api/v1/auth/passwort — eigenes Passwort ändern (Self-Service und
// erzwungener Wechsel nach Initial-Login). Erfordert eine angemeldete Sitzung
// UND das korrekte aktuelle Passwort. Löscht danach das Wechsel-Flag.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req.headers)
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

  const parsed = passwortAendernSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const payload = await payloadClient()

  // Aktuelles Passwort verifizieren (login wirft bei falschem Passwort).
  try {
    await payload.login({
      collection: 'users',
      data: { email: user.email, password: parsed.data.aktuellesPasswort },
    })
  } catch {
    return NextResponse.json(
      { error: 'Aktuelles Passwort falsch', code: 'WRONG_PASSWORD' },
      { status: 400 },
    )
  }

  await payload.update({
    collection: 'users',
    id: user.id,
    data: { password: parsed.data.neuesPasswort, passwortWechselErforderlich: false },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true })
}
