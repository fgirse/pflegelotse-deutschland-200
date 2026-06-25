import type { Geo } from '@/shared/domain'
import type { RoutingProvider } from './RoutingProvider'

// Echtes Straßenrouting über einen OSRM-Server (Open Source Routing Machine).
// Nutzt den `table`-Service, der in EINEM Request die komplette Fahrzeit-Matrix
// zwischen allen Punkten liefert — genau das, was der Fit-Score braucht.
//
// OSRM erwartet Koordinaten als "lng,lat" (Länge zuerst!) und gibt Dauern in
// SEKUNDEN zurück; wir rechnen auf Minuten um (Vertrag des Ports).
// Doku: https://project-osrm.org/docs/v5.24.0/api/#table-service
export class OsrmRoutingProvider implements RoutingProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly profile = 'driving',
    // Optionaler API-Key. Steht der OSRM-Server hinter einem Reverse-Proxy mit
    // Schlüsselprüfung (Produktion), wird er als X-Api-Key-Header gesendet.
    private readonly apiKey?: string,
    // Zeitlimit, damit ein langsamer/abgestürzter OSRM-Server die interaktive
    // Antwort (< 1 s, /F220/) nicht blockiert. Bei Timeout greift der Fallback.
    private readonly timeoutMs = 4000,
  ) {}

  async travelMatrix(points: Geo[]): Promise<number[][]> {
    const n = points.length
    if (n === 0) return []
    if (n === 1) return [[0]]

    // "lng,lat;lng,lat;…" — OSRM-Koordinatenreihenfolge ist Länge vor Breite.
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
    const base = this.baseUrl.replace(/\/+$/, '') // trailing Slash entfernen
    const url = `${base}/table/v1/${this.profile}/${coords}?annotations=duration`

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
    const headers = this.apiKey ? { 'X-Api-Key': this.apiKey } : undefined
    let res: Response
    try {
      res = await fetch(url, { signal: ctrl.signal, headers })
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) {
      throw new Error(`OSRM-Antwort ${res.status} ${res.statusText}`)
    }
    const data = (await res.json()) as {
      code?: string
      durations?: (number | null)[][]
    }
    if (data.code !== 'Ok' || !Array.isArray(data.durations)) {
      throw new Error(`OSRM-Fehler: ${data.code ?? 'unbekannt'}`)
    }

    // Sekunden → Minuten. Nicht erreichbare Paare liefert OSRM als null;
    // die behandeln wir als „unendlich weit" (Infinity), damit der Fit-Score
    // solche Touren als nicht passend verwirft, statt mit 0 zu rechnen.
    return data.durations.map((zeile) =>
      zeile.map((sek) => (sek == null ? Infinity : sek / 60)),
    )
  }
}
