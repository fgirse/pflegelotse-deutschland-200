import { NextResponse, type NextRequest } from 'next/server'
import { pseudonymIdSchema } from '@/shared/domain'
import { requireAuth } from '@/server/auth/guard'
import { ladeKlientIdentitaet } from '@/server/klienten/identitaet'

export const dynamic = 'force-dynamic'

// GET /api/v1/klienten/[pseudonymId]/identitaet — Klartext-Identität (Name/
// Adresse) eines eigenen Klienten für die Planungs-/Kartenansicht. Nur
// Disponent/Admin, mandantengebunden. Bringt bewusst PII (Säule 1) in die UI.
export async function GET(req: NextRequest, ctx: { params: Promise<{ pseudonymId: string }> }) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const { pseudonymId } = await ctx.params
  if (!pseudonymIdSchema.safeParse(pseudonymId).success) {
    return NextResponse.json({ error: 'Ungültige Kennung' }, { status: 400 })
  }

  const identitaet = await ladeKlientIdentitaet(auth.user.tenantId, pseudonymId)
  if (!identitaet) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ identitaet })
}
