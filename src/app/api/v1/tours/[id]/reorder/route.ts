import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { planeReihenfolge } from '@/server/matching/service'
import { requireAuth } from '@/server/auth/guard'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  // Neue Reihenfolge der Einsätze als Liste der pseudonymIds.
  reihenfolge: z.array(z.string()).min(1),
  // true = nur Vorschau (nicht speichern). Default false.
  probe: z.boolean().optional(),
})

// POST /api/v1/tours/{id}/reorder — bewertet/speichert eine per Drag&Drop
// gewählte Stopp-Reihenfolge (§5.2.3). Mit probe=true nur Vorschau: liefert
// Kennzahlen + je Stopp den Zeitfenster-Status, ohne zu schreiben.
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { id } = await params
  const res = await planeReihenfolge(
    auth.user.tenantId,
    id,
    parsed.data.reihenfolge,
    parsed.data.probe !== true,
  )
  if (res === null) return NextResponse.json({ error: 'Tour nicht gefunden' }, { status: 404 })
  if ('ungueltig' in res) {
    return NextResponse.json({ error: 'Reihenfolge passt nicht zur Tour' }, { status: 400 })
  }
  return NextResponse.json(res)
}
