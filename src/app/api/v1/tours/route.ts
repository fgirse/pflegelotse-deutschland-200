import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { geoSchema } from '@/shared/domain'
import { ladeTouren, erstelleTour } from '@/server/repo'
import { requireAuth } from '@/server/auth/guard'

// GET /api/v1/tours — Touren des eingeloggten Mandanten (Säule 2).
// Geschützt: Auth + Rolle + 2FA; tenantId kommt aus dem Nutzer.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers)
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }
  const datum = req.nextUrl.searchParams.get('datum') ?? undefined
  const touren = await ladeTouren(auth.user.tenantId, datum)
  return NextResponse.json({ touren })
}

// Eingabe zum Erstellen einer neuen (leeren) Tour. tenantId setzt der Server
// aus dem Nutzer, die id vergibt die DB.
// Felder außer datum/pflegekraftId/start sind optional: fehlt eines, erbt die
// Tour-Anlage den Wert aus dem Pflegekraft-Stammprofil (repo.erstelleTour).
const neueTourSchema = z.object({
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum als YYYY-MM-DD erwartet'),
  pflegekraftId: z.string().min(1),
  pflegekraftQualifikation: z.array(z.string()).optional(),
  pflegekraftGeschlecht: z.enum(['m', 'w', 'd']).optional(),
  start: geoSchema, // Depot/Startpunkt (aus Adress-Geocoding)
  startZeit: z.number().int().min(0).max(1439).optional(),
  verfuegbarBis: z.number().int().min(0).max(1439).optional(),
  maxEinsaetze: z.number().int().min(0).max(50).optional(),
})

// POST /api/v1/tours — legt eine neue leere Tour an. Tourenplanung ist
// Disponenten-/Inhaber-Sache (wie /tours/assign).
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = neueTourSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const tour = await erstelleTour({ tenantId: auth.user.tenantId, ...parsed.data })
  return NextResponse.json({ tour }, { status: 201 })
}
