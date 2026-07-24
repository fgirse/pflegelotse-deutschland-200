import { NextResponse, type NextRequest } from 'next/server'
import { ladeTour, speichereEinsaetze } from '@/server/repo'
import { optimiereTour } from '@/server/matching/service'
import { requireAuth } from '@/server/auth/guard'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/v1/tours/{id}/optimize — optimiert die Stopp-Reihenfolge einer Tour
// (VRPTW-Sequencing, Pflichtenheft 5.2.1) und speichert die neue Reihenfolge.
// Tourenplanung ist Disponenten-/Inhaber-Sache (wie /tours/assign).
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response

  const { id } = await params
  const tour = await ladeTour(id)
  if (!tour) return NextResponse.json({ error: 'Tour nicht gefunden' }, { status: 404 })
  // Mandantengrenze: nur eigene Touren bearbeiten.
  if (tour.tenantId !== auth.user.tenantId) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  const geplant = await optimiereTour(tour)
  const gespeichert = await speichereEinsaetze(id, geplant.einsaetze)

  return NextResponse.json({
    tour: gespeichert,
    kennzahlen: {
      fahrzeitMin: geplant.fahrzeitMin,
      pflegezeitMin: geplant.pflegezeitMin,
      grundzeitMin: geplant.grundzeitMin,
      auslastungProzent: geplant.auslastungProzent,
      arbeitszeitMin: geplant.arbeitszeitMin,
      arbzgKonform: geplant.arbzgKonform,
      machbar: geplant.machbar,
    },
  })
}
