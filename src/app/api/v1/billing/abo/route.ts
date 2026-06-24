import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { starteAbo, holeAboStatus } from '@/server/billing/subscription'
import { requireAuth } from '@/server/auth/guard'

export const dynamic = 'force-dynamic'

const postSchema = z.object({ stufe: z.enum(['klein', 'mittel', 'gross']) })

// POST /api/v1/billing/abo — startet ein SaaS-Abo (/F1030/). Inhaber-Aktion;
// Mandant + Kontakt aus dem angemeldeten Nutzer.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }
  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const { checkoutUrl, paymentId } = await starteAbo(
      auth.user.tenantId,
      parsed.data.stufe,
      auth.user.email,
    )
    return NextResponse.json({ checkoutUrl, paymentId }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 })
  }
}

// GET /api/v1/billing/abo — Abo-Status des eingeloggten Mandanten.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }
  const abo = await holeAboStatus(auth.user.tenantId)
  return NextResponse.json({ abo })
}
