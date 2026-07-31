import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth/guard'
import { mitarbeiterAnlegenSchema } from '@/shared/mitarbeiter'
import { listeMitarbeiter, erstelleMitarbeiter } from '@/server/team/service'

export const dynamic = 'force-dynamic'

// GET /api/v1/team/mitarbeiter — Pflegekräfte des eigenen Mandanten.
// Nur der Dienst-Inhaber (admin); tenantId kommt aus der Sitzung.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }
  const mitarbeiter = await listeMitarbeiter(auth.user.tenantId)
  return NextResponse.json({ mitarbeiter })
}

// POST /api/v1/team/mitarbeiter — neue Pflegekraft anlegen. Rolle + tenantId
// werden serverseitig gesetzt; der Client liefert nur die fachlichen Felder.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const parsed = mitarbeiterAnlegenSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const ergebnis = await erstelleMitarbeiter(auth.user.tenantId, parsed.data)
  if (ergebnis.status === 'email_existiert') {
    return NextResponse.json(
      { error: 'E-Mail bereits registriert', code: 'EMAIL_EXISTS' },
      { status: 409 },
    )
  }
  return NextResponse.json({ ok: true, mitarbeiter: ergebnis.mitarbeiter }, { status: 201 })
}
