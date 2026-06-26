// Bekannte Orte/Stadtteile der Pilotregion Freiburg mit Koordinaten.
// Geteilt zwischen Bedarfsformular (Angehörige) und Einzugsgebiet (Dienste),
// damit beide Seiten dieselben Referenzpunkte verwenden.
export const ORTE: Record<string, { lat: number; lng: number }> = {
  Innenstadt: { lat: 47.995, lng: 7.852 },
  Wiehre: { lat: 47.988, lng: 7.851 },
  Herdern: { lat: 48.013, lng: 7.846 },
  Stühlinger: { lat: 47.998, lng: 7.838 },
  Littenweiler: { lat: 47.978, lng: 7.905 },
}

export type OrtName = keyof typeof ORTE

// Haversine-Distanz in Kilometern zwischen zwei Koordinaten.
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
