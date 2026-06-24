import { NextResponse, type NextRequest } from 'next/server'
import { holeKontakt } from '@/server/marketplace/service'
import { requireAuth } from '@/server/auth/guard'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/v1/bedarfe/[id]/kontakt — Kontaktfreigabe. Geschützt; der anfragende
// Dienst (tenantId) kommt aus dem Nutzer. holeKontakt gibt die Daten nur frei,
// wenn dieser Dienst gewählt wurde (Anti-Leakage /F340/); sonst 403.
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req.headers)
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }
  const { id } = await params
  const kontakt = await holeKontakt(id, auth.user.tenantId)
  if (!kontakt) {
    return NextResponse.json(
      { error: 'Kontakt nicht freigegeben (Auswahl ausstehend oder anderer Dienst)' },
      { status: 403 },
    )
  }
  return NextResponse.json({ kontakt })
}
