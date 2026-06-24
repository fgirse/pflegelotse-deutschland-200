import { env } from '@/lib/env'

export const serverUrl = env.NEXT_PUBLIC_SERVER_URL

// Webhook-URL nur, wenn die App öffentlich per HTTPS erreichbar ist — Mollie
// weist localhost/HTTP ab. Lokal wird der Status aktiv gepollt.
export function webhookUrl(): string | undefined {
  if (serverUrl.startsWith('https://') && !serverUrl.includes('localhost')) {
    return `${serverUrl}/api/v1/billing/webhook`
  }
  return undefined
}
