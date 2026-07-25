import { NextResponse, type NextRequest } from 'next/server'
import { ladeTouren } from '@/server/repo'
import { requireAuth } from '@/server/auth/guard'

const DATUM = /^\d{4}-\d{2}-\d{2}$/

// GET /api/v1/erfassung/heute?datum=YYYY-MM-DD — Tagestour(en) der angemeldeten
// Pflegekraft (§5.3). Ist pflegekraftId am Nutzer gesetzt, wird streng darauf
// gefiltert (§9.5: nur eigene, aktuelle Daten); sonst alle Touren des Tages
// (für Disponent/Admin zum Testen). datum kommt als Gerätedatum vom Client.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['pflegekraft', 'disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const datum = req.nextUrl.searchParams.get('datum')
  if (!datum || !DATUM.test(datum)) {
    return NextResponse.json({ error: 'datum als YYYY-MM-DD erforderlich' }, { status: 400 })
  }

  const alle = await ladeTouren(auth.user.tenantId, datum)
  const meine = auth.user.pflegekraftId
    ? alle.filter((t) => t.pflegekraftId === auth.user.pflegekraftId)
    : alle

  // Nur die für die mobile Erfassung nötigen Felder (schlank, §9.5).
  const touren = meine.map((t) => ({
    id: t.id,
    pflegekraftId: t.pflegekraftId,
    datum: t.datum,
    einsaetze: t.einsaetze.map((e) => ({
      pseudonymId: e.pseudonymId,
      geo: e.geo,
      zeitfenster: e.zeitfenster,
      istAnkunft: e.istAnkunft ?? null,
      erledigt: Boolean(e.erledigt),
    })),
  }))

  return NextResponse.json({ datum, touren })
}
