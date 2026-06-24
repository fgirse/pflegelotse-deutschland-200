import type { Geo } from '@/shared/domain'
import type { RoutingProvider } from './RoutingProvider'

// Haversine-Distanz in Kilometern zwischen zwei Koordinaten.
function haversineKm(a: Geo, b: Geo): number {
  const R = 6371 // Erdradius in km
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Heuristischer Routing-Adapter: Luftlinie × Umwegfaktor / Geschwindigkeit.
// Der Umwegfaktor (1.3) nähert reale Straßenführung an; die
// Durchschnittsgeschwindigkeit (~30 km/h) entspricht Stadt-/Vorortverkehr.
// Bewusst grob — als Platzhalter, bis OSRM echte Fahrzeiten liefert.
export class HaversineRoutingProvider implements RoutingProvider {
  constructor(
    private readonly umwegFaktor = 1.3,
    private readonly kmh = 30,
  ) {}

  async travelMatrix(points: Geo[]): Promise<number[][]> {
    const n = points.length
    const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const km = haversineKm(points[i], points[j]) * this.umwegFaktor
        const min = (km / this.kmh) * 60
        m[i][j] = min
        m[j][i] = min // symmetrisch
      }
    }
    return m
  }
}
