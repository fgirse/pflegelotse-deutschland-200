import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { waehleDienst } from '@/server/marketplace/service'

type Ctx = { params: Promise<{ id: string }> }

// POST — Angehörige wählt einen Dienst. Das gibt die Kontaktdaten frei (/F340/).
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = z.object({ tenantId: z.string().min(1) }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    await waehleDienst(id, parsed.data.tenantId)
    return NextResponse.json({ ok: true, status: 'vergeben' })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 })
  }
}
