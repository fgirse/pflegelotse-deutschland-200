// ── Geocoding-Port (Ports & Adapters) ────────────────────────────────────
// Wandelt eine Freitext-Adresse/Ort in Koordinaten. Aktueller Adapter:
// Nominatim (OpenStreetMap). Austauschbar (eigener Server, anderer Anbieter)
// ohne Änderung der Aufrufer.
export interface GeoTreffer {
  lat: number
  lng: number
  displayName: string
}

export interface GeocodingProvider {
  geocode(query: string): Promise<GeoTreffer | null>
}
