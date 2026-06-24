import { NextResponse, type NextRequest } from 'next/server'
import { finalisierePraevention } from '@/server/praevention/service'
import { requireAuth } from '@/server/auth/guard'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

// POST — Empfehlung finalisieren (fachliche Entscheidung der Pflegekraft, /F940/).
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req.headers, { roles: ['pflegekraft', 'disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })
  const { id } = await params
  const p = await finalisierePraevention(id, auth.user.tenantId)
  if (!p) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ praevention: p })
}
