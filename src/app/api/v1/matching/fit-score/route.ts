import { NextResponse, type NextRequest } from 'next/server'
import { fitScoreRequestSchema } from '@/shared/domain'
import { ladeTouren, ladeTour } from '@/server/repo'
import { berechneFitScore } from '@/server/matching/service'
import { requireAuth } from '@/server/auth/guard'

// POST /api/v1/matching/fit-score — bewertet einen Kandidaten gegen die Touren
// des eingeloggten Mandanten. Trefferliste sortiert nach Mehrweg (/F230/).
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers)
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const raw = await req.json().catch(() => null)
  // tenantId wird serverseitig erzwungen — niemals aus dem Body übernehmen.
  const parsed = fitScoreRequestSchema.safeParse({ ...raw, tenantId: auth.user.tenantId })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { tenantId, kandidat, tourIds } = parsed.data

  const touren = tourIds?.length
    ? (await Promise.all(tourIds.map(ladeTour)))
        .filter((t) => t !== null)
        .filter((t) => t!.tenantId === tenantId) // nur eigene Touren
    : await ladeTouren(tenantId)

  const ergebnis = await berechneFitScore(touren, kandidat)
  return NextResponse.json(ergebnis)
}
