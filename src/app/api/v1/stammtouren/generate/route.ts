import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { generiereWochenplan } from '@/server/planning/service'
import { requireAuth } from '@/server/auth/guard'

const bodySchema = z.object({
  // Beliebiges Datum in der Zielwoche (YYYY-MM-DD); der Service normalisiert
  // auf den Montag dieser Woche.
  datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum als YYYY-MM-DD erwartet'),
})

// POST /api/v1/stammtouren/generate — erzeugt den Wochenrahmenplan aus den
// Stammtouren (Pflichtenheft 5.2.2). Disponenten-/Inhaber-Sache; idempotent.
export async function POST(req: NextRequest) {
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

  const ergebnis = await generiereWochenplan(auth.user.tenantId, parsed.data.datum)
  return NextResponse.json(ergebnis, { status: 201 })
}
