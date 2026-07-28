import type { Geo } from '@/shared/domain'
import type { RoutingProvider } from './RoutingProvider'

// Resilienz-Wrapper: versucht zuerst den primären Adapter (z. B. OSRM) und
// fällt bei JEDEM Fehler — Timeout, Netzwerk, OSRM-Ausfall — still auf den
// Ersatz (z. B. Haversine) zurück. So liefert die Tourenplanung immer ein
// Ergebnis; im Störfall nur gröber statt gar nicht.
export class FallbackRoutingProvider implements RoutingProvider {
  // public readonly, damit der Composition-Test die gewählte Kette
  // (welcher Provider ist primär?) inspizieren kann.
  constructor(
    readonly primaer: RoutingProvider,
    readonly ersatz: RoutingProvider,
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

  // Distanzmatrix mit derselben Resilienz: primär, bei Fehler Ersatz (Haversine).
  async distanzMatrix(points: Geo[]): Promise<number[][]> {
    if (this.primaer.distanzMatrix) {
      try {
        return await this.primaer.distanzMatrix(points)
      } catch (err) {
        console.warn(
          '[routing] Primäre Distanzmatrix fehlgeschlagen, nutze Fallback:',
          err instanceof Error ? err.message : err,
        )
      }
    }
    if (this.ersatz.distanzMatrix) return this.ersatz.distanzMatrix(points)
    throw new Error('[routing] kein Distanzmatrix-Adapter verfügbar')
  }
}
