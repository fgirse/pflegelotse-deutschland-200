import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { holeZahlungsStatus } from '@/server/billing/service'

// GET /api/v1/billing/status?paymentId=tr_... — Status-Polling (frischt von
// Mollie nach). Für die Rückkehrseite nach dem Checkout.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const parsed = z
    .object({ paymentId: z.string().min(1) })
    .safeParse({ paymentId: req.nextUrl.searchParams.get('paymentId') })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const status = await holeZahlungsStatus(parsed.data.paymentId)
  if (!status) return NextResponse.json({ error: 'Zahlung nicht gefunden' }, { status: 404 })
  return NextResponse.json(status)
}
