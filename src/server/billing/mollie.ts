import { env } from '@/lib/env'

// ── Mollie-Client (Payment-Provider) ─────────────────────────────────────
// Schlanker Wrapper um die Mollie-HTTP-API. Bewusst ohne SDK, um die
// Abhängigkeiten klein zu halten (Prinzip P7).
const MOLLIE_API = 'https://api.mollie.com/v2'

export interface MolliePayment {
  id: string
  status: 'open' | 'paid' | 'failed' | 'canceled' | 'expired' | 'pending' | 'authorized'
  checkoutUrl?: string
  amount: { value: string; currency: string }
  metadata?: Record<string, unknown> | null
  // Bei wiederkehrenden Zahlungen gesetzt (Subscription-Einzug).
  customerId?: string
  subscriptionId?: string
  sequenceType?: string
}

export interface MollieCustomer {
  id: string
}

export interface MollieSubscription {
  id: string
  status: string
}

function apiKey(): string {
  if (!env.MOLLIE_API_KEY) throw new Error('MOLLIE_API_KEY fehlt')
  return env.MOLLIE_API_KEY
}

function mapPayment(d: any): MolliePayment {
  return {
    id: d.id,
    status: d.status,
    checkoutUrl: d._links?.checkout?.href,
    amount: d.amount,
    metadata: d.metadata ?? null,
    customerId: d.customerId,
    subscriptionId: d.subscriptionId,
    sequenceType: d.sequenceType,
  }
}

// Erstellt eine Zahlung und liefert u. a. die Checkout-URL.
// Für Abos: customerId + sequenceType "first" setzen — die bezahlte
// Erstzahlung erzeugt das Mandat, das die spätere Subscription braucht.
export async function createPayment(params: {
  amountCents: number
  description: string
  redirectUrl: string
  webhookUrl?: string
  metadata?: Record<string, unknown>
  customerId?: string
  sequenceType?: 'oneoff' | 'first'
}): Promise<MolliePayment> {
  const body: Record<string, unknown> = {
    amount: { currency: 'EUR', value: (params.amountCents / 100).toFixed(2) },
    description: params.description,
    redirectUrl: params.redirectUrl,
    metadata: params.metadata,
  }
  // webhookUrl nur setzen, wenn öffentlich erreichbar — Mollie weist
  // localhost/HTTP ab. Lokal wird der Status stattdessen aktiv abgefragt.
  if (params.webhookUrl) body.webhookUrl = params.webhookUrl
  if (params.customerId) body.customerId = params.customerId
  if (params.sequenceType) body.sequenceType = params.sequenceType

  const res = await fetch(`${MOLLIE_API}/payments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Mollie-Fehler ${res.status}: ${text}`)
  }
  return mapPayment(await res.json())
}

// Legt einen Mollie-Kunden an (Träger des Mandats und der Subscription).
export async function createCustomer(name: string, email?: string): Promise<MollieCustomer> {
  const res = await fetch(`${MOLLIE_API}/customers`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ name, ...(email ? { email } : {}) }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Mollie-Fehler ${res.status}: ${text}`)
  }
  const d = await res.json()
  return { id: d.id }
}

// Legt eine wiederkehrende Subscription auf einem Kunden an. Setzt ein gültiges
// Mandat voraus (durch eine bezahlte Erstzahlung mit sequenceType "first").
export async function createSubscription(
  customerId: string,
  params: {
    amountCents: number
    interval: string // z. B. "1 month"
    description: string
    webhookUrl?: string
    startDate?: string // "YYYY-MM-DD"
    metadata?: Record<string, unknown>
  },
): Promise<MollieSubscription> {
  const body: Record<string, unknown> = {
    amount: { currency: 'EUR', value: (params.amountCents / 100).toFixed(2) },
    interval: params.interval,
    description: params.description,
    metadata: params.metadata,
  }
  if (params.webhookUrl) body.webhookUrl = params.webhookUrl
  if (params.startDate) body.startDate = params.startDate

  const res = await fetch(`${MOLLIE_API}/customers/${customerId}/subscriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Mollie-Fehler ${res.status}: ${text}`)
  }
  const d = await res.json()
  return { id: d.id, status: d.status }
}

// Holt den aktuellen Status einer Zahlung (für Webhook und Status-Polling).
export async function getPayment(id: string): Promise<MolliePayment> {
  const res = await fetch(`${MOLLIE_API}/payments/${id}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Mollie-Fehler ${res.status}: ${text}`)
  }
  return mapPayment(await res.json())
}
