import { NextResponse, type NextRequest } from 'next/server'
import { ladeTouren } from '@/server/repo'
import { requireAuth } from '@/server/auth/guard'

// GET /api/v1/tours — Touren des eingeloggten Mandanten (Säule 2).
// Geschützt: Auth + Rolle + 2FA; tenantId kommt aus dem Nutzer.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers)
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }
  const datum = req.nextUrl.searchParams.get('datum') ?? undefined
  const touren = await ladeTouren(auth.user.tenantId, datum)
  return NextResponse.json({ touren })
}
