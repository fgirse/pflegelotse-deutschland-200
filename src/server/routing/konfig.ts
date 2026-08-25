import { env } from '@/lib/env'
import type { RoutingKonfig } from './waehleRouting'
import { pruefeRouting, type RoutingStatus } from './status'

// Liest die routing-relevante Konfiguration aus der Umgebung. Bewusst eine
// eigene, dünne Datei: der Routing-Kern (waehleRouting/status) bleibt dadurch
// env-frei und ohne Ladenebenwirkung testbar — nur wer hier importiert, löst
// den Env-Parse aus.
export function routingKonfig(): RoutingKonfig {
  return {
    provider: env.ROUTING_PROVIDER,
    osrmBaseUrl: env.OSRM_BASE_URL,
    osrmProfile: env.OSRM_PROFILE,
    osrmApiKey: env.OSRM_API_KEY,
    hereApiKey: env.HERE_API_KEY,
  }
}

// Aktueller Betriebsstatus des Routings gemäß Umgebung (gecacht in status.ts).
export function routingStatus(): Promise<RoutingStatus> {
  return pruefeRouting(routingKonfig())
}
