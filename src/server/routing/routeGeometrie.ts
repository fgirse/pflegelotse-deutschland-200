import { env } from '@/lib/env'
import type { Geo } from '@/shared/domain'
import { waehleRoutingKern } from './waehleRouting'

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

  const provider = waehleRoutingKern({
    provider: env.ROUTING_PROVIDER,
    osrmBaseUrl: env.OSRM_BASE_URL,
    osrmProfile: env.OSRM_PROFILE,
    osrmApiKey: env.OSRM_API_KEY,
    hereApiKey: env.HERE_API_KEY,
  })

  if (provider.routeGeometrie) {
    try {
      const geometrie = await provider.routeGeometrie(points)
      if (geometrie.length >= 2) return { geometrie, quelle: 'osrm' }
    } catch {
      // stiller Fallback auf Luftlinie
    }
  }
  return { geometrie: points, quelle: 'luftlinie' }
}
