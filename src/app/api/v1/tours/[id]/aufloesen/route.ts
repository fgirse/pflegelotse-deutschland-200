import { NextResponse, type NextRequest } from 'next/server'
import { planeUmverteilung, wendeUmverteilungAn } from '@/server/matching/service'
import { requireAuth } from '@/server/auth/guard'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/v1/tours/{id}/aufloesen — kurzfristige Umplanung (Pflichtenheft
// 5.2.2): verteilt die Einsätze einer ausfallenden Tour auf die anderen
// verfügbaren Touren des Tages. Mit ?probe=1 nur Vorschau (kein Schreiben).
// Disponenten-/Inhaber-Sache.
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const { id } = await params
  const probe = req.nextUrl.searchParams.get('probe') === '1'

  const ergebnis = probe
    ? await planeUmverteilung(auth.user.tenantId, id)
    : await wendeUmverteilungAn(auth.user.tenantId, id)

  if (!ergebnis) return NextResponse.json({ error: 'Tour nicht gefunden' }, { status: 404 })
  return NextResponse.json(ergebnis, { status: probe ? 200 : 201 })
}
