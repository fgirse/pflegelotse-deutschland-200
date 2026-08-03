import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth/guard'
import { ladeEigenePflegekraftId } from '@/server/team/service'
import { loescheAbwesenheit } from '@/server/abwesenheit/service'

export const dynamic = 'force-dynamic'

// DELETE /api/v1/team/mitarbeiter/[id]/abwesenheiten/[abwesenheitId] — löscht
// eine Abwesenheit der Pflegekraft. Nur Admin, mandanten-/kraftgebunden.
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; abwesenheitId: string }> },
) {
  const auth = await requireAuth(req.headers, { roles: ['admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const { id, abwesenheitId } = await ctx.params
  const kuerzel = await ladeEigenePflegekraftId(auth.user.tenantId, id)
  if (!kuerzel) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })

  const ok = await loescheAbwesenheit(auth.user.tenantId, kuerzel, abwesenheitId)
  if (!ok) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
