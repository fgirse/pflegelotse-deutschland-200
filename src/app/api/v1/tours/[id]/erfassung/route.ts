import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { erfasseIst } from '@/server/matching/service'
import { requireAuth } from '@/server/auth/guard'

type Ctx = { params: Promise<{ id: string }> }

const bodySchema = z
  .object({
    pseudonymId: z.string().min(1),
    event: z.enum(['ankunft', 'erledigt', 'abweichung']),
    // Ist-Zeit in Minuten seit Mitternacht (Gerätezeit der Pflegekraft).
    zeit: z.number().int().min(0).max(1439).optional(),
    grund: z.string().optional(),
    // Client-Aktions-ID für Offline-Replay (§5.3); serverseitig hier unkritisch.
    aktionId: z.string().optional(),
  })
  .refine(
    (d) => (d.event === 'abweichung' ? typeof d.grund === 'string' : typeof d.zeit === 'number'),
    'Für Ankunft/Erledigt ist zeit nötig, für Abweichung ein grund.',
  )

// POST /api/v1/tours/{id}/erfassung — mobile Leistungserfassung (§5.3): stempelt
// die Ist-Ankunft/-Abfahrt oder meldet eine Abweichung an einem Einsatz.
// Zugriff auch für Pflegekräfte (Außendienst).
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
  const res = await erfasseIst(auth.user.tenantId, id, parsed.data)
  if (res === null) return NextResponse.json({ error: 'Tour nicht gefunden' }, { status: 404 })
  if ('ungueltig' in res) return NextResponse.json({ error: 'Einsatz nicht in dieser Tour' }, { status: 400 })
  return NextResponse.json(res)
}
