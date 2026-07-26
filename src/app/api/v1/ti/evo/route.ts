import { NextResponse, type NextRequest } from 'next/server'
import { evoSchema } from '@/server/ti/evo'
import { verarbeiteEvo } from '@/server/ti/service'
import { requireAuth } from '@/server/auth/guard'

// POST /api/v1/ti/evo — Eingang einer elektronischen Verordnung (§8.2).
// STUB-Transport: die Nutzlast kommt hier direkt als JSON. Im echten Betrieb
// liefert sie der KIM-Fachdienst/Konnektor (SMC-B) an genau diesen Handler.
// Geschützt: der Dienst empfängt in seinen eigenen Mandanten (tenantId).
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = evoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const ergebnis = await verarbeiteEvo(auth.user.tenantId, parsed.data)
  const status = ergebnis.status === 'geocoding_fehlgeschlagen' ? 422 : 201
  return NextResponse.json(ergebnis, { status })
}
