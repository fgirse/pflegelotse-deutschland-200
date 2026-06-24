import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { pseudonymIdSchema } from '@/shared/domain'
import { starteExpressCheckout } from '@/server/billing/service'

// POST /api/v1/billing/checkout — startet die Express-Zahlung (/F1020/).
// Antwort: Mollie-Checkout-URL, auf die der Browser weitergeleitet wird.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = z.object({ bedarfId: pseudonymIdSchema }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const { checkoutUrl, paymentId } = await starteExpressCheckout(parsed.data.bedarfId)
    return NextResponse.json({ checkoutUrl, paymentId }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
