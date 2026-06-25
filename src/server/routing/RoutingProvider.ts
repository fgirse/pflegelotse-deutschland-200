import type { Geo } from '@/shared/domain'

// ── Routing-Port (Ports & Adapters) ──────────────────────────────────────
// Liefert eine Reisezeit-Matrix zwischen Punkten in MINUTEN.
// Adapter: HaversineRoutingProvider (Heuristik, keine Infra) und
// OsrmRoutingProvider (echtes Straßenrouting). Welcher aktiv ist, steuert
// ROUTING_PROVIDER; die Auswahl betrifft nur den Composition Root in
// matching/service.ts, nicht den Fit-Score. matrix[i][j] = Fahrzeit i → j.
export interface RoutingProvider {
  travelMatrix(points: Geo[]): Promise<number[][]>
}
