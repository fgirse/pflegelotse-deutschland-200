import type { Geo } from '@/shared/domain'
import type { RoutingProvider } from './RoutingProvider'
import { meldeDegradierung } from './degradierung'

// Resilienz-Wrapper: versucht zuerst den primären Adapter (z. B. OSRM) und
// fällt bei JEDEM Fehler — Timeout, Netzwerk, OSRM-Ausfall — auf den Ersatz
// (z. B. Haversine) zurück. So liefert die Tourenplanung immer ein Ergebnis;
// im Störfall nur gröber statt gar nicht.
//
// Der Rückfall ist bewusst NICHT still: er wird über meldeDegradierung() ans
// Monitoring gegeben. Sonst plant der Dienst weiter mit Luftlinien-Zahlen und
// merkt nichts davon — genau der Fall, den man im Betrieb sehen muss.
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
      meldeDegradierung('nichtErreichbar', err instanceof Error ? err.message : String(err))
      return this.ersatz.travelMatrix(points)
    }
  }

  // Distanzmatrix mit derselben Resilienz: primär, bei Fehler Ersatz (Haversine).
  async distanzMatrix(points: Geo[]): Promise<number[][]> {
    if (this.primaer.distanzMatrix) {
      try {
        return await this.primaer.distanzMatrix(points)
      } catch (err) {
        meldeDegradierung('nichtErreichbar', err instanceof Error ? err.message : String(err))
      }
    }
    if (this.ersatz.distanzMatrix) return this.ersatz.distanzMatrix(points)
    throw new Error('[routing] kein Distanzmatrix-Adapter verfügbar')
  }

  // Straßen-Geometrie nur vom primären Provider (Haversine hat keine). Schlägt
  // er fehl oder kann es nicht, wirft die Methode — der Aufrufer (routeGeometrie-
  // Service) fällt dann auf die Luftlinie zurück.
  async routeGeometrie(points: Geo[]): Promise<Geo[]> {
    if (this.primaer.routeGeometrie) return this.primaer.routeGeometrie(points)
    throw new Error('[routing] primärer Provider ohne Straßen-Geometrie')
  }
}
