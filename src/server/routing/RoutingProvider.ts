import type { Geo } from '@/shared/domain'

// ── Routing-Port (Ports & Adapters) ──────────────────────────────────────
// Liefert eine Reisezeit-Matrix zwischen Punkten in MINUTEN.
// Aktueller Adapter: Haversine-Heuristik (sofort lauffähig, keine Infra).
// Später austauschbar gegen einen OSRM/VROOM-Adapter — ohne dass sich der
// Fit-Score-Code ändert. matrix[i][j] = Fahrzeit von Punkt i nach j.
export interface RoutingProvider {
  travelMatrix(points: Geo[]): Promise<number[][]>
}
