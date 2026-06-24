import { NextResponse, type NextRequest } from 'next/server'
import { verarbeiteZahlung } from '@/server/billing/service'

// POST /api/v1/billing/webhook — Mollie meldet Statusänderungen.
// Mollie sendet application/x-www-form-urlencoded mit `id=tr_...` und erwartet
// 200. Wir holen den echten Status aktiv von Mollie (nie dem Body vertrauen).
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const text = await req.text()
  const id = new URLSearchParams(text).get('id')
  if (!id) return NextResponse.json({ error: 'id fehlt' }, { status: 400 })
  try {
    await verarbeiteZahlung(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    // 500 → Mollie wiederholt den Aufruf später.
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
