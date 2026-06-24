import type { Where } from 'payload'
import { payloadClient } from '@/server/payloadClient'
import {
  createCustomer,
  createPayment,
  createSubscription,
  type MolliePayment,
} from './mollie'

// Interner Zahlungsstatus (identisch zur Enum der zahlungen-Collection).
type ZahlungStatus = 'offen' | 'bezahlt' | 'fehlgeschlagen' | 'storniert' | 'abgelaufen'
import { ABO_TIERS, type AboStufe } from './pricing'
import { serverUrl, webhookUrl } from './urls'

// ── SaaS-Abo als Mollie-Subscription (/F1030/) ───────────────────────────
// Flow: Kunde anlegen → Erstzahlung (sequenceType "first") erzeugt das Mandat →
// nach Bezahlung wird die wiederkehrende Subscription angelegt. Importiert
// bewusst NICHT billing/service (umgekehrte Richtung), um Zyklen zu vermeiden.

// Datum + 1 Monat als "YYYY-MM-DD" (Startdatum der Subscription, damit der
// erste Monat nicht doppelt — über die Erstzahlung — berechnet wird).
function datumPlusMonat(d: Date): string {
  const n = new Date(d)
  n.setMonth(n.getMonth() + 1)
  return n.toISOString().slice(0, 10)
}

function centsAusBetrag(value: string): number {
  return Math.round(parseFloat(value) * 100)
}

// Startet ein Abo: Kunde + mandatsbildende Erstzahlung. Liefert die Checkout-URL.
export async function starteAbo(
  tenantId: string,
  stufe: AboStufe,
  email?: string,
): Promise<{ checkoutUrl: string; paymentId: string }> {
  const tier = ABO_TIERS[stufe]
  const payload = await payloadClient()

  // Bereits aktives Abo? Dann nicht erneut starten.
  const bestehend = await payload.find({
    collection: 'abos',
    where: { and: [{ tenantId: { equals: tenantId } }, { status: { equals: 'aktiv' } }] },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  if (bestehend.docs.length > 0) throw new Error('Es besteht bereits ein aktives Abo')

  const customer = await createCustomer(`Dienst ${tenantId}`, email)

  const payment = await createPayment({
    amountCents: tier.monatlichCents,
    description: `PflegeLotse Abo ${stufe} (erster Monat)`,
    redirectUrl: `${serverUrl}/de/abo`,
    webhookUrl: webhookUrl(),
    customerId: customer.id,
    sequenceType: 'first',
    metadata: { art: 'abo', tenantId, stufe },
  })
  if (!payment.checkoutUrl) throw new Error('Mollie lieferte keine Checkout-URL')

  // Abo-Datensatz (ausstehend bis zur bezahlten Erstzahlung).
  await payload.create({
    collection: 'abos',
    data: {
      tenantId,
      stufe,
      monatlichCents: tier.monatlichCents,
      status: 'ausstehend',
      mollieCustomerId: customer.id,
      firstPaymentId: payment.id,
    },
    overrideAccess: true,
  })

  // Erstzahlung als Ledger-Eintrag (damit der Webhook sie zuordnen kann).
  await payload.create({
    collection: 'zahlungen',
    data: {
      art: 'abo',
      status: 'offen',
      betragCents: tier.monatlichCents,
      waehrung: 'EUR',
      beschreibung: `Abo ${stufe} – Erstzahlung`,
      tenantId,
      molliePaymentId: payment.id,
    },
    overrideAccess: true,
  })

  return { checkoutUrl: payment.checkoutUrl, paymentId: payment.id }
}

// Wird vom Webhook aufgerufen, wenn eine Abo-Zahlung bezahlt wurde. Ist es die
// mandatsbildende Erstzahlung, wird die wiederkehrende Subscription angelegt.
export async function aktiviereAboFallsErstzahlung(payment: MolliePayment): Promise<void> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'abos',
    where: { firstPaymentId: { equals: payment.id } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  const abo = res.docs[0]
  if (!abo || abo.status === 'aktiv') return // unbekannt oder schon aktiv

  if (!abo.mollieCustomerId) return
  try {
    const sub = await createSubscription(abo.mollieCustomerId, {
      amountCents: abo.monatlichCents,
      interval: '1 month',
      description: `PflegeLotse Abo ${abo.stufe}`,
      webhookUrl: webhookUrl(),
      startDate: datumPlusMonat(new Date()), // erster Folgeeinzug in einem Monat
      metadata: { tenantId: abo.tenantId },
    })
    await payload.update({
      collection: 'abos',
      id: abo.id,
      data: {
        status: 'aktiv',
        mollieSubscriptionId: sub.id,
        activatedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
  } catch (e) {
    console.error('Subscription-Anlage fehlgeschlagen:', e)
  }
}

// Erfasst einen automatischen Folgeeinzug (Mollie meldet eine uns noch
// unbekannte Zahlung mit subscriptionId) als neuen Ledger-Eintrag.
export async function erfasseWiederkehrendeZahlung(payment: MolliePayment, status: ZahlungStatus) {
  const payload = await payloadClient()
  // Mandant über die Subscription bzw. den Kunden auflösen.
  const where: Where = payment.subscriptionId
    ? { mollieSubscriptionId: { equals: payment.subscriptionId } }
    : { mollieCustomerId: { equals: payment.customerId ?? '' } }
  const res = await payload.find({ collection: 'abos', where, limit: 1, overrideAccess: true, depth: 0 })
  const abo = res.docs[0]

  const created = await payload.create({
    collection: 'zahlungen',
    data: {
      art: 'abo',
      status,
      betragCents: centsAusBetrag(payment.amount.value),
      waehrung: payment.amount.currency,
      beschreibung: 'Abo – Folgeeinzug',
      tenantId: abo?.tenantId,
      molliePaymentId: payment.id,
    },
    overrideAccess: true,
  })
  return created
}

// Aktuellen Abo-Status eines Mandanten lesen.
export async function holeAboStatus(tenantId: string) {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'abos',
    where: { tenantId: { equals: tenantId } },
    limit: 1,
    sort: '-createdAt',
    overrideAccess: true,
    depth: 0,
  })
  const a = res.docs[0]
  if (!a) return null
  return {
    stufe: a.stufe,
    status: a.status,
    monatlichCents: a.monatlichCents,
    aktivSeit: a.activatedAt ?? null,
  }
}
