import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth/guard'
import { mitarbeiterStatusSchema } from '@/shared/mitarbeiter'
import { setzeMitarbeiterStatus, loescheMitarbeiter } from '@/server/team/service'

export const dynamic = 'force-dynamic'

// PATCH /api/v1/team/mitarbeiter/[id] { deaktiviert } — Offboarding-Statuswechsel.
// Nur Admin; die Kraft muss zum eigenen Mandanten gehören (im Service geprüft).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req.headers, { roles: ['admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const parsed = mitarbeiterStatusSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { id } = await ctx.params
  const zeile = await setzeMitarbeiterStatus(auth.user.tenantId, id, parsed.data.deaktiviert)
  if (!zeile) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true, mitarbeiter: zeile })
}

// DELETE /api/v1/team/mitarbeiter/[id] — Pflegekraft endgültig löschen.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req.headers, { roles: ['admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const { id } = await ctx.params
  const ok = await loescheMitarbeiter(auth.user.tenantId, id)
  if (!ok) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
