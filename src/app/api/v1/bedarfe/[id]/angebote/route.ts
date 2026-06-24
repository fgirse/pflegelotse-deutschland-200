import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { gibAngebotAb, listeAngebote } from '@/server/marketplace/service'
import { requireAuth } from '@/server/auth/guard'

type Ctx = { params: Promise<{ id: string }> }

// GET — Angebote zu einem Bedarf (Angehörigen-Vergleichsansicht). Öffentlich:
// nur über die nicht erratbare Bedarfs-ID erreichbar, die die Angehörige besitzt.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const angebote = await listeAngebote(id)
  return NextResponse.json({ angebote })
}

const postSchema = z.object({
  nachricht: z.string().default(''),
  mehrwegMin: z.number().optional(),
})

// POST — ein Dienst gibt ein verbindliches Angebot ab. Geschützt; der Dienst
// (tenantId) wird aus dem angemeldeten Nutzer abgeleitet.
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(req.headers)
  if (!auth.ok) return auth.response
  if (!auth.user.tenantId) {
    return NextResponse.json({ error: 'Kein Mandant zugeordnet' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const angebot = await gibAngebotAb(
      id,
      auth.user.tenantId,
      parsed.data.nachricht,
      parsed.data.mehrwegMin,
    )
    return NextResponse.json({ angebot }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 })
  }
}
