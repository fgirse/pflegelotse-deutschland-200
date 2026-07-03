import type { Geo } from '@/shared/domain'
import type { RoutingProvider } from './RoutingProvider'

// Verkehrsbewusstes Straßenrouting über die HERE Matrix Routing API v8
// (EU-Anbieter, DSGVO-freundlich — Pflichtenheft Kap. 8.1). Liefert in EINEM
// Request die komplette Fahrzeit-Matrix zwischen allen Punkten und berücksichtigt
// dabei den Verkehr: `departureTime` steuert die live-/historische Verkehrslage.
//
// Genutzt wird der synchrone Endpoint (async=false) im „flexible"-Modus (mit
// Verkehr). Dieser ist auf bis zu 15 Origins begrenzt; für größere Punktzahlen
// wirft der Adapter, und der FallbackRoutingProvider weicht auf Haversine aus.
// Antwortzeiten kommen als flaches, zeilenweises Array travelTimes[i*n+j] in
// SEKUNDEN; wir rechnen auf Minuten um (Vertrag des Ports).
// Doku: https://www.here.com/docs/bundle/matrix-routing-api-v8-api-reference
export class HereRoutingProvider implements RoutingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly transportMode = 'car',
    // Zeitlimit, damit ein langsamer HERE-Dienst die interaktive Antwort
    // (< 1 s, /F220/) nicht blockiert. Bei Timeout greift der Fallback.
    private readonly timeoutMs = 4000,
    // Abfahrtszeit für die Verkehrsbewertung (Standard: jetzt = aktuelle Lage).
    // Injizierbar für deterministische Tests.
    private readonly jetzt: () => Date = () => new Date(),
  ) {}

  async travelMatrix(points: Geo[]): Promise<number[][]> {
    const n = points.length
    if (n === 0) return []
    if (n === 1) return [[0]]
    // Sync-„flexible" (mit Verkehr) erlaubt max. 15 Origins → sonst Fallback.
    if (n > 15) throw new Error(`HERE: ${n} Punkte über Sync-Limit (15)`)

    const url = `https://matrix.router.hereapi.com/v8/matrix?async=false&apiKey=${encodeURIComponent(this.apiKey)}`
    const body = {
      origins: points.map((p) => ({ lat: p.lat, lng: p.lng })),
      regionDefinition: { type: 'autoCircle' }, // aus den Origins abgeleitet
      matrixAttributes: ['travelTimes'],
      transportMode: this.transportMode,
      departureTime: this.jetzt().toISOString(), // → Verkehrsdaten einbeziehen
    }

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) throw new Error(`HERE-Antwort ${res.status} ${res.statusText}`)
    const data = (await res.json()) as {
      matrix?: {
        numOrigins: number
        numDestinations: number
        travelTimes?: number[]
        errorCodes?: number[]
      }
    }
    const m = data.matrix
    if (!m || !Array.isArray(m.travelTimes)) {
      throw new Error('HERE-Fehler: keine travelTimes in der Antwort')
    }

    // Flaches Array travelTimes[i*numDestinations + j] → Matrix; Sek → Min.
    // errorCodes != 0 (z. B. Ziel nicht erreichbar) behandeln wir als Infinity,
    // damit der Fit-Score solche Paare verwirft, statt mit 0 zu rechnen.
    const nd = m.numDestinations
    const out: number[][] = []
    for (let i = 0; i < m.numOrigins; i++) {
      const zeile: number[] = []
      for (let j = 0; j < nd; j++) {
        const idx = i * nd + j
        const fehler = m.errorCodes ? m.errorCodes[idx] : 0
        const sek = m.travelTimes[idx]
        zeile.push(fehler || sek == null ? Infinity : sek / 60)
      }
      out.push(zeile)
    }
    return out
  }
}
