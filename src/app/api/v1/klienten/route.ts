import { NextResponse, type NextRequest } from 'next/server'
import { klientAnlegenSchema } from '@/shared/klient'
import { requireAuth } from '@/server/auth/guard'
import { erstelleKlient } from '@/server/klienten/anlegen'

export const dynamic = 'force-dynamic'

// POST /api/v1/klienten — neuen Klienten anlegen (beide Säulen). Nur Disponent/
// Admin; tenantId aus der Sitzung.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const parsed = klientAnlegenSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const klient = await erstelleKlient(auth.user.tenantId, parsed.data)
  return NextResponse.json({ ok: true, klient }, { status: 201 })
}
