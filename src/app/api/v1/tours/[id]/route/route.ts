import { NextResponse, type NextRequest } from 'next/server'
import { ladeTour } from '@/server/repo'
import { ladeRouteGeometrie } from '@/server/routing/routeGeometrie'
import { requireAuth } from '@/server/auth/guard'
import type { Geo } from '@/shared/domain'

export const dynamic = 'force-dynamic'

// GET /api/v1/tours/[id]/route — Straßen-Geometrie der Tour (Depot → Stopps) für
// die Kartendarstellung. Disponent/Admin sehen alle eigenen Touren; die
// Pflegekraft nur ihre eigene (per pflegekraftId). Mandantengebunden.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin', 'pflegekraft'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const { id } = await ctx.params
  const tour = await ladeTour(id)
  if (!tour || tour.tenantId !== auth.user.tenantId) {
    return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  }
  // Pflegekraft: nur die eigene Tour (Kürzel muss übereinstimmen).
  if (auth.user.role === 'pflegekraft' && tour.pflegekraftId !== auth.user.pflegekraftId) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 })
  }

  // Punktfolge: Depot (Start) + Stopps in Tour-Reihenfolge.
  const points: Geo[] = [tour.start, ...tour.einsaetze.map((e) => e.geo)]
  const route = await ladeRouteGeometrie(points)
  return NextResponse.json(route)
}
