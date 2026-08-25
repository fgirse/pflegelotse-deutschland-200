import type { Geo } from '@/shared/domain'
import { waehleRoutingKern } from './waehleRouting'
import { routingKonfig } from './konfig'
import { istKonfiguriert } from './status'
import { meldeDegradierung } from './degradierung'

export interface RouteGeometrie {
  geometrie: Geo[]
  // 'osrm' = echte Straßenroute; 'luftlinie' = Verbindungsgeraden (Fallback).
  quelle: 'osrm' | 'luftlinie'
}

// Liefert die Straßen-Geometrie einer Route (Depot → Stopps in Reihenfolge).
// Ist ein Straßen-Provider (OSRM) konfiguriert und erreichbar, kommt die echte
// Route; sonst — oder bei Fehler — die Luftlinie (die Eingabepunkte selbst).
export async function ladeRouteGeometrie(points: Geo[]): Promise<RouteGeometrie> {
  if (points.length < 2) return { geometrie: points, quelle: 'luftlinie' }

  const cfg = routingKonfig()
  const provider = waehleRoutingKern(cfg)

  if (provider.routeGeometrie) {
    try {
      const geometrie = await provider.routeGeometrie(points)
      if (geometrie.length >= 2) return { geometrie, quelle: 'osrm' }
    } catch (err) {
      // Der Rückfall auf die Luftlinie war früher still. Ist ein Straßen-
      // Provider konfiguriert, ist ein Fehler hier ein echter Störfall und
      // gehört gemeldet — sonst zeigt die Karte dauerhaft Geraden, ohne dass
      // jemand erfährt, dass der Routing-Server klemmt.
      if (istKonfiguriert(cfg)) {
        meldeDegradierung('nichtErreichbar', err instanceof Error ? err.message : String(err))
      }
    }
  }
  return { geometrie: points, quelle: 'luftlinie' }
}
