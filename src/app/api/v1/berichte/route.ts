import { NextResponse, type NextRequest } from 'next/server'
import { berechneBerichte } from '@/server/berichte/service'
import { requireAuth } from '@/server/auth/guard'

const DATUM = /^\d{4}-\d{2}-\d{2}$/

// GET /api/v1/berichte?von&bis — §5.4-Berichte (Mitarbeiterauslastung +
// Kilometernachweis) als JSON für die Anzeige.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })

  const von = req.nextUrl.searchParams.get('von')
  const bis = req.nextUrl.searchParams.get('bis')
  if (!von || !bis || !DATUM.test(von) || !DATUM.test(bis)) {
    return NextResponse.json({ error: 'von/bis als YYYY-MM-DD erforderlich' }, { status: 400 })
  }

  const berichte = await berechneBerichte(auth.user.tenantId, von, bis)
  return NextResponse.json(berichte)
}
