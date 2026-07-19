import { HaversineRoutingProvider } from './HaversineRoutingProvider'
import { OsrmRoutingProvider } from './OsrmRoutingProvider'
import { HereRoutingProvider } from './HereRoutingProvider'
import { FallbackRoutingProvider } from './FallbackRoutingProvider'
import type { RoutingProvider } from './RoutingProvider'

// Routing-relevante Konfiguration (Teilmenge der Env). Als eigener Typ, damit
// die Provider-Auswahl unabhängig von der globalen Env-Ladung getestet werden
// kann — der Import dieser Datei löst keinen Env-Parse aus.
export type RoutingKonfig = {
  provider: 'haversine' | 'osrm' | 'here'
  osrmBaseUrl?: string
  osrmProfile: string
  osrmApiKey?: string
  hereApiKey?: string
}

// Wählt den primären Routing-Adapter anhand der Konfiguration und hüllt ihn in
// den Fallback auf Haversine (Luftlinien-Heuristik als Sicherheitsnetz).
//
// Wichtig fürs Produkt: Der Kernnutzen ("passgenaue Zusatzmarge auf die reale
// Route") hängt an ECHTEN Fahrzeiten. Ist ein Straßen-Provider angefordert,
// aber unvollständig konfiguriert (z. B. 'here' ohne API-Key), liefe das System
// still auf Luftlinie. Das warnen wir hier LAUT, damit die Degradierung nicht
// unbemerkt bleibt — kein stiller Qualitätsverlust.
export function waehleRoutingKern(cfg: RoutingKonfig): RoutingProvider {
  const haversine = new HaversineRoutingProvider()

  if (cfg.provider === 'osrm') {
    if (!cfg.osrmBaseUrl) {
      console.warn('[routing] ROUTING_PROVIDER=osrm, aber OSRM_BASE_URL fehlt → Fallback auf Haversine (Luftlinie)')
      return haversine
    }
    const osrm = new OsrmRoutingProvider(cfg.osrmBaseUrl, cfg.osrmProfile, cfg.osrmApiKey)
    return new FallbackRoutingProvider(osrm, haversine)
  }

  if (cfg.provider === 'here') {
    if (!cfg.hereApiKey) {
      console.warn('[routing] ROUTING_PROVIDER=here, aber HERE_API_KEY fehlt → Fallback auf Haversine (Luftlinie)')
      return haversine
    }
    const here = new HereRoutingProvider(cfg.hereApiKey)
    return new FallbackRoutingProvider(here, haversine)
  }

  return haversine
}
