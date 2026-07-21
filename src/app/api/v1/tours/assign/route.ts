import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { geoSchema, zeitfensterSchema, pseudonymIdSchema, type Einsatz } from '@/shared/domain'
import { ladeTour, speichereEinsaetze } from '@/server/repo'
import { planeTour } from '@/server/matching/service'
import { requireAuth } from '@/server/auth/guard'

const bodySchema = z.object({
  tourId: z.string().min(1),
  position: z.number().int().min(0),
  // true = unverbindliche Probe-Einplanung eines offenen Bedarfs.
  probe: z.boolean().optional(),
  kandidat: z.object({
    pseudonymId: pseudonymIdSchema,
    geo: geoSchema,
    zeitfenster: zeitfensterSchema,
    dauerMin: z.number().int().positive().default(30),
    grundzeitMin: z.number().int().min(0).optional(),
    qualifikation: z.array(z.string()).default([]),
  }),
})

// POST /api/v1/tours/assign — Ein-Klick-Lückenfüllung: fügt den Kandidaten an
// der angegebenen Position ein, ordnet die Tour neu und speichert sie.
export async function POST(req: NextRequest) {
  // Tourenplanung ist Disponenten-/Inhaber-Sache.
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { tourId, position, probe, kandidat } = parsed.data

  const tour = await ladeTour(tourId)
  if (!tour) return NextResponse.json({ error: 'Tour nicht gefunden' }, { status: 404 })
  // Mandantengrenze: nur eigene Touren bearbeiten.
  if (tour.tenantId !== auth.user.tenantId) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // Neuen Einsatz an Position einfügen.
  const neuerEinsatz: Einsatz = {
    pseudonymId: kandidat.pseudonymId,
    geo: kandidat.geo,
    zeitfenster: kandidat.zeitfenster,
    dauerMin: kandidat.dauerMin,
    grundzeitMin: kandidat.grundzeitMin,
    qualifikation: kandidat.qualifikation,
    probe: probe ?? false,
  }
  const pos = Math.min(position, tour.einsaetze.length)
  const einsaetze = [...tour.einsaetze]
  einsaetze.splice(pos, 0, neuerEinsatz)

  // Tour neu planen (Ankunftszeiten) und persistieren.
  const geplant = await planeTour({ ...tour, einsaetze })
  const gespeichert = await speichereEinsaetze(tourId, geplant.einsaetze)

  return NextResponse.json({
    tour: gespeichert,
    kennzahlen: {
      fahrzeitMin: geplant.fahrzeitMin,
      pflegezeitMin: geplant.pflegezeitMin,
      grundzeitMin: geplant.grundzeitMin, // separat ausgewiesen (Pflichtenheft 5.1.3)
      auslastungProzent: geplant.auslastungProzent,
    },
  })
}
