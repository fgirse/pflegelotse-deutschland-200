import type { Geo } from '@/shared/domain'

// ── Routing-Port (Ports & Adapters) ──────────────────────────────────────
// Liefert eine Reisezeit-Matrix zwischen Punkten in MINUTEN.
// Adapter: HaversineRoutingProvider (Heuristik, keine Infra) und
// OsrmRoutingProvider (echtes Straßenrouting). Welcher aktiv ist, steuert
// ROUTING_PROVIDER; die Auswahl betrifft nur den Composition Root in
// matching/service.ts, nicht den Fit-Score. matrix[i][j] = Fahrzeit i → j.
export interface RoutingProvider {
  travelMatrix(points: Geo[]): Promise<number[][]>
  // Optionale Distanz-Matrix in KILOMETERN (für den Kilometernachweis §5.4).
  // Bei OSRM/HERE echte Straßen-km; Haversine liefert die geometrische Schätzung.
  // Optional, damit schlanke Test-Stubs nur travelMatrix implementieren müssen.
  distanzMatrix?(points: Geo[]): Promise<number[][]>
  // Optionale Straßen-Geometrie (Polyline) entlang der Punkte in Reihenfolge
  // (Depot → Stopp 1 → …), für die Kartendarstellung der Route. Nur echte
  // Straßen-Provider (OSRM); ohne Unterstützung fällt der Aufrufer auf die
  // Luftlinie (die Eingabepunkte) zurück.
  routeGeometrie?(points: Geo[]): Promise<Geo[]>
}
