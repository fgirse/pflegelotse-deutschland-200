import { NextResponse, type NextRequest } from 'next/server'
import { erzeugeNachweisDokument } from '@/server/nachweis/service'
import { requireAuth } from '@/server/auth/guard'

type Ctx = { params: Promise<{ pseudonymId: string }> }

// GET /api/v1/klienten/{pseudonymId}/leistungsnachweis — erzeugt den
// rechtssicheren Leistungsnachweis (§5.4) als Markdown, inkl. Integritätsstatus
// der Hash-Kette. Verbindet Säule-2-Einträge mit der Identität aus Säule 1 →
// nur für Rollen mit Klientendatenzugriff.
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }

  const { pseudonymId } = await params
  const doc = await erzeugeNachweisDokument(auth.user.tenantId, pseudonymId)
  if (!doc) return NextResponse.json({ error: 'Keine Nachweise gefunden' }, { status: 404 })
  return NextResponse.json(doc)
}
