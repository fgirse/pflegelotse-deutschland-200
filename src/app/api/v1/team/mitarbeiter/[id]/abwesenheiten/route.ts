import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth/guard'
import { abwesenheitSchema } from '@/shared/abwesenheit'
import { ladeEigenePflegekraftId } from '@/server/team/service'
import { listeAbwesenheiten, erstelleAbwesenheit } from '@/server/abwesenheit/service'

export const dynamic = 'force-dynamic'

// GET/POST /api/v1/team/mitarbeiter/[id]/abwesenheiten — Abwesenheiten einer
// Pflegekraft lesen/anlegen. Nur Admin; die Kraft muss zum eigenen Mandanten
// gehören und ein Kürzel (pflegekraftId) haben.
async function pflegekraftId(req: NextRequest, id: string) {
  const auth = await requireAuth(req.headers, { roles: ['admin'] })
  if (!auth.ok) return { error: auth.response as NextResponse }
  if (!auth.user.tenantId) {
    return { error: NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 }) }
  }
  const kuerzel = await ladeEigenePflegekraftId(auth.user.tenantId, id)
  if (!kuerzel) {
    return { error: NextResponse.json({ error: 'Kürzel erforderlich', code: 'KUERZEL_REQUIRED' }, { status: 409 }) }
  }
  return { tenantId: auth.user.tenantId, kuerzel }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const r = await pflegekraftId(req, id)
  if ('error' in r) return r.error
  const abwesenheiten = await listeAbwesenheiten(r.tenantId, r.kuerzel)
  return NextResponse.json({ abwesenheiten })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const r = await pflegekraftId(req, id)
  if ('error' in r) return r.error

  const parsed = abwesenheitSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const abwesenheit = await erstelleAbwesenheit(r.tenantId, r.kuerzel, parsed.data)
  return NextResponse.json({ ok: true, abwesenheit }, { status: 201 })
}
