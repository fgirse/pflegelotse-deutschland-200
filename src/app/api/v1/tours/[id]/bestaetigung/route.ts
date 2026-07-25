import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { bestaetigeLeistung } from '@/server/nachweis/service'
import { requireAuth } from '@/server/auth/guard'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  pseudonymId: z.string().min(1),
  // Optional: konkret erbrachte Leistungskomplexe; sonst die geplanten des Klienten.
  erbrachteLeistungen: z.array(z.string()).optional(),
  // Gerätezeit (Min seit Mitternacht) der Erledigung.
  zeit: z.number().int().min(0).max(1439).optional(),
})

// POST /api/v1/tours/{id}/bestaetigung — bestätigt die erbrachten Leistungen
// eines Besuchs und schreibt einen revisionssicheren Nachweis-Eintrag (§5.4).
// Auch für Pflegekräfte (Außendienst).
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req.headers, { roles: ['pflegekraft', 'disponent', 'admin'] })
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
  const res = await bestaetigeLeistung(auth.user.tenantId, id, {
    ...parsed.data,
    bestaetigtVon: auth.user.email,
  })
  if (res === null) return NextResponse.json({ error: 'Tour nicht gefunden' }, { status: 404 })
  if ('ungueltig' in res) return NextResponse.json({ error: 'Einsatz nicht in dieser Tour' }, { status: 400 })
  return NextResponse.json(res, { status: 201 })
}
