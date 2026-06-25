import type { Geo } from '@/shared/domain'
import type { RoutingProvider } from './RoutingProvider'

// Resilienz-Wrapper: versucht zuerst den primären Adapter (z. B. OSRM) und
// fällt bei JEDEM Fehler — Timeout, Netzwerk, OSRM-Ausfall — still auf den
// Ersatz (z. B. Haversine) zurück. So liefert die Tourenplanung immer ein
// Ergebnis; im Störfall nur gröber statt gar nicht.
export class FallbackRoutingProvider implements RoutingProvider {
  constructor(
    private readonly primaer: RoutingProvider,
    private readonly ersatz: RoutingProvider,
  ) {}

  async travelMatrix(points: Geo[]): Promise<number[][]> {
    try {
      return await this.primaer.travelMatrix(points)
    } catch (err) {
      console.warn(
        '[routing] Primärer Provider fehlgeschlagen, nutze Fallback:',
        err instanceof Error ? err.message : err,
      )
      return this.ersatz.travelMatrix(points)
    }
  }
}
