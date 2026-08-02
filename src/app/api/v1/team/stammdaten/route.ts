import { NextResponse, type NextRequest } from 'next/server'
import { requireAuth } from '@/server/auth/guard'
import { ladePflegekraftStamm } from '@/server/stammdaten/service'

export const dynamic = 'force-dynamic'

// GET /api/v1/team/stammdaten?pflegekraftId=xxx — Stammprofil einer Pflegekraft
// im eigenen Mandanten (für die Vorbelegung der Tour-Anlage). Disponent/Admin.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const pflegekraftId = req.nextUrl.searchParams.get('pflegekraftId')?.trim()
  if (!pflegekraftId) {
    return NextResponse.json({ error: 'pflegekraftId erforderlich' }, { status: 400 })
  }

  const stamm = await ladePflegekraftStamm(auth.user.tenantId, pflegekraftId)
  return NextResponse.json({ stamm })
}
