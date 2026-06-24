import { NextResponse, type NextRequest } from 'next/server'
import { ladePraevention } from '@/server/praevention/service'
import { formulierePraeventionstext } from '@/server/ki/praeventionstext'
import { requireAuth } from '@/server/auth/guard'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

// POST — KI-Formulierungsvorschlag für den Begründungstext (/F940/, optional).
// Formuliert nur die bereits gewählten Empfehlungen aus; die Pflegekraft prüft.
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req.headers, { roles: ['pflegekraft', 'disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })
  const { id } = await params
  const p = await ladePraevention(id, auth.user.tenantId)
  if (!p) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  try {
    const text = await formulierePraeventionstext(p.empfehlungen)
    return NextResponse.json({ text })
  } catch (e) {
    console.error('KI-Formulierungshilfe-Fehler:', (e as Error).message)
    return NextResponse.json({ error: 'KI-Formulierungshilfe derzeit nicht verfügbar.' }, { status: 502 })
  }
}
