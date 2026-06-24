import { NextResponse, type NextRequest } from 'next/server'
import { ladeKlientenOperativ } from '@/server/repo'
import { requireAuth } from '@/server/auth/guard'

// GET /api/v1/clients — operative Klienten des eingeloggten Mandanten (Säule 2).
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers)
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const klienten = await ladeKlientenOperativ(auth.user.tenantId, status)
  return NextResponse.json({ klienten })
}
