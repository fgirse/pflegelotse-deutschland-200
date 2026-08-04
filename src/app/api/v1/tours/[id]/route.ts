import { NextResponse, type NextRequest } from 'next/server'
import { loescheTour } from '@/server/repo'
import { requireAuth } from '@/server/auth/guard'

export const dynamic = 'force-dynamic'

// DELETE /api/v1/tours/[id] — Tour endgültig löschen. Tourenplanung ist
// Disponenten-/Inhaber-Sache; nur eigene Touren (mandantengebunden).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const { id } = await ctx.params
  const ok = await loescheTour(auth.user.tenantId, id)
  if (!ok) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
