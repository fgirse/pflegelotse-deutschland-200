import { payloadClient } from '@/server/payloadClient'
import { createPayment, getPayment, type MolliePayment } from './mollie'
import { EXPRESS_CENTS, LEAD_FEE_CENTS } from './pricing'
import { serverUrl, webhookUrl } from './urls'
import { aktiviereAboFallsErstzahlung, erfasseWiederkehrendeZahlung } from './subscription'

// ── Billing-Service (Mollie) ─────────────────────────────────────────────
// Importiert bewusst NICHT den Marktplatz-Service (der Marktplatz ruft dieses
// Modul auf) — Aktualisierungen an Bedarfen laufen direkt über payloadClient.

type ZahlungStatus = 'offen' | 'bezahlt' | 'fehlgeschlagen' | 'storniert' | 'abgelaufen'

// Mollie-Status → interner Zahlungsstatus.
function mapStatus(s: MolliePayment['status']): ZahlungStatus {
  switch (s) {
    case 'paid':
      return 'bezahlt'
    case 'failed':
      return 'fehlgeschlagen'
    case 'canceled':
      return 'storniert'
    case 'expired':
      return 'abgelaufen'
    default:
      return 'offen' // open / pending / authorized
  }
}

// Startet die einmalige Express-Zahlung (/F1020/) für einen Bedarf.
export async function starteExpressCheckout(
  bedarfId: string,
): Promise<{ checkoutUrl: string; paymentId: string }> {
  const payment = await createPayment({
    amountCents: EXPRESS_CENTS,
    description: 'PflegeLotse Express-Vermittlung',
    redirectUrl: `${serverUrl}/de/markt/${bedarfId}`,
    webhookUrl: webhookUrl(),
    metadata: { art: 'express', bedarfId },
  })

  const payload = await payloadClient()
  await payload.create({
    collection: 'zahlungen',
    data: {
      art: 'express',
      status: 'offen',
      betragCents: EXPRESS_CENTS,
      waehrung: 'EUR',
      beschreibung: 'Express-Vermittlung',
      bedarfId,
      molliePaymentId: payment.id,
    },
    overrideAccess: true,
  })

  if (!payment.checkoutUrl) throw new Error('Mollie lieferte keine Checkout-URL')
  return { checkoutUrl: payment.checkoutUrl, paymentId: payment.id }
}

// Verarbeitet eine Mollie-Statusänderung (Webhook ODER aktives Polling):
// holt den echten Status von Mollie und aktualisiert die Zahlung. Bei
// bezahlter Express-Zahlung wird der Bedarf priorisiert (express=true).
export async function verarbeiteZahlung(molliePaymentId: string): Promise<{ status: string }> {
  const mollie = await getPayment(molliePaymentId)
  const status = mapStatus(mollie.status)
  const payload = await payloadClient()

  const treffer = await payload.find({
    collection: 'zahlungen',
    where: { molliePaymentId: { equals: molliePaymentId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  let zahlung = treffer.docs[0]

  // Unbekannte Zahlung mit Subscription-Bezug = automatischer Folgeeinzug eines
  // Abos → als neuen Ledger-Eintrag erfassen (/F1030/).
  if (!zahlung && mollie.subscriptionId) {
    zahlung = await erfasseWiederkehrendeZahlung(mollie, status)
  }
  if (!zahlung) return { status }

  await payload.update({
    collection: 'zahlungen',
    id: zahlung.id,
    data: { status, ...(status === 'bezahlt' ? { paidAt: new Date().toISOString() } : {}) },
    overrideAccess: true,
  })

  // Express bezahlt → Bedarf priorisieren.
  if (status === 'bezahlt' && zahlung.art === 'express' && zahlung.bedarfId) {
    await payload.update({
      collection: 'bedarfe',
      where: { pseudonymId: { equals: zahlung.bedarfId } },
      data: { express: true },
      overrideAccess: true,
    })
  }

  // Abo-Erstzahlung bezahlt → Mollie-Subscription anlegen und Abo aktivieren.
  if (status === 'bezahlt' && zahlung.art === 'abo') {
    await aktiviereAboFallsErstzahlung(mollie)
  }

  return { status }
}

// Erfasst die Vermittlungsgebühr beim Kontaktfreigabe-Ereignis (/F1040/).
// LECK-SICHER: an das technisch erzwungene Auswahl-/Freigabe-Ereignis gekoppelt,
// nicht an einen Lead. Idempotent je Bedarf.
export async function erfasseVermittlungsgebuehr(
  tenantId: string,
  bedarfId: string,
): Promise<void> {
  const payload = await payloadClient()
  const vorhanden = await payload.find({
    collection: 'zahlungen',
    where: {
      and: [{ bedarfId: { equals: bedarfId } }, { art: { equals: 'gebuehr' } }],
    },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  if (vorhanden.docs.length > 0) return // schon erfasst

  await payload.create({
    collection: 'zahlungen',
    data: {
      art: 'gebuehr',
      status: 'offen',
      betragCents: LEAD_FEE_CENTS,
      waehrung: 'EUR',
      beschreibung: 'Vermittlungsgebühr (Kontaktfreigabe)',
      tenantId,
      bedarfId,
    },
    overrideAccess: true,
  })
}

// Status einer Zahlung abfragen (lokales Polling, frischt von Mollie nach).
export async function holeZahlungsStatus(molliePaymentId: string) {
  await verarbeiteZahlung(molliePaymentId)
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'zahlungen',
    where: { molliePaymentId: { equals: molliePaymentId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  const z = res.docs[0]
  if (!z) return null
  return { status: z.status, art: z.art, betragCents: z.betragCents }
}
