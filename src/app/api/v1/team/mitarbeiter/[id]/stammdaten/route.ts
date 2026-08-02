import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth/guard'
import { pflegekraftStammSchema } from '@/shared/pflegekraftStamm'
import { ladeEigenePflegekraftId } from '@/server/team/service'
import { speicherePflegekraftStamm } from '@/server/stammdaten/service'

export const dynamic = 'force-dynamic'

// PUT /api/v1/team/mitarbeiter/[id]/stammdaten — operatives Stammprofil einer
// Pflegekraft speichern. Nur Admin; die Kraft muss zum eigenen Mandanten gehören
// und ein Kürzel (pflegekraftId) haben, sonst gibt es keinen Verknüpfungsschlüssel.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req.headers, { roles: ['admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const { id } = await ctx.params
  const pflegekraftId = await ladeEigenePflegekraftId(auth.user.tenantId, id)
  if (!pflegekraftId) {
    return NextResponse.json(
      { error: 'Kürzel erforderlich', code: 'KUERZEL_REQUIRED' },
      { status: 409 },
    )
  }

  const parsed = pflegekraftStammSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  await speicherePflegekraftStamm(auth.user.tenantId, pflegekraftId, parsed.data)
  return NextResponse.json({ ok: true })
}
