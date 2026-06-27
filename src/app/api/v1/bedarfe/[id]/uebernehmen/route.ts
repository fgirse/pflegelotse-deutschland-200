import { NextResponse, type NextRequest } from 'next/server'
import { uebernehmeBedarfAlsKlient } from '@/server/marketplace/service'
import { requireAuth } from '@/server/auth/guard'

type Ctx = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

// POST /api/v1/bedarfe/[id]/uebernehmen — übernimmt einen gewonnenen Bedarf als
// Klient in die Tourenplanung. Disponenten-/Inhaber-Sache; Mandant aus Auth.
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req.headers, { roles: ['disponent', 'admin'] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }
  const { id } = await params
  try {
    const r = await uebernehmeBedarfAlsKlient(id, auth.user.tenantId)
    return NextResponse.json(r, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 })
  }
}
