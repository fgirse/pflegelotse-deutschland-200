import { env } from '@/lib/env'

// ── Benachrichtigungs-Port (Ports & Adapters) ────────────────────────────
// Im MVP nur E-Mail; das Pflichtenheft sieht zusätzlich SMS/Push vor (/F420/).
// Der Adapter ist austauschbar, ohne dass der aufrufende Code sich ändert.
export interface Notifier {
  // idempotencyKey verhindert Doppelversand bei Retries (Resend-Gotcha).
  sende(to: string, subject: string, html: string, idempotencyKey?: string): Promise<void>
}

// Dev/Test: schreibt nur ins Log, sendet nichts.
export class ConsoleNotifier implements Notifier {
  async sende(to: string, subject: string): Promise<void> {
    console.log(`[notify:console] → ${to}: ${subject}`)
  }
}

// Produktion: versendet über die Resend-HTTP-API.
export class ResendNotifier implements Notifier {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async sende(
    to: string,
    subject: string,
    html: string,
    idempotencyKey?: string,
  ): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
        // Idempotency-Key schützt vor Doppelversand bei Wiederholungen.
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify({ from: this.from, to, subject, html }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Resend-Fehler ${res.status}: ${text}`)
    }
  }
}

// Wählt den Adapter: echter Versand nur, wenn NOTIFY_ENABLED=true UND ein
// Resend-Key vorhanden ist — sonst sicherer Konsolen-Adapter (Dev/Test).
let instance: Notifier | undefined
export function getNotifier(): Notifier {
  if (!instance) {
    if (env.NOTIFY_ENABLED === 'true' && env.RESEND_API_KEY) {
      instance = new ResendNotifier(env.RESEND_API_KEY, env.EMAIL_FROM)
    } else {
      instance = new ConsoleNotifier()
    }
  }
  return instance
}
