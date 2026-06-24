import { NextResponse, type NextRequest } from 'next/server'
import { praevErstellenSchema } from '@/shared/praevention'
import { ladePraevention, aktualisierePraevention } from '@/server/praevention/service'
import { requireAuth } from '@/server/auth/guard'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }
const ROLLEN = ['pflegekraft', 'disponent', 'admin'] as const

// GET — eine Empfehlung des Mandanten.
export async function GET(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req.headers, { roles: [...ROLLEN] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })
  const { id } = await params
  const p = await ladePraevention(id, auth.user.tenantId)
  if (!p) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
  return NextResponse.json({ praevention: p })
}

// POST — Entwurf aktualisieren (Felder/Empfehlungen/Freitext).
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req.headers, { roles: [...ROLLEN] })
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) return NextResponse.json({ error: 'Kein Mandant' }, { status: 403 })
  const { id } = await params
  const parsed = praevErstellenSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const p = await aktualisierePraevention(id, auth.user.tenantId, parsed.data)
    if (!p) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 })
    return NextResponse.json({ praevention: p })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 })
  }
}
