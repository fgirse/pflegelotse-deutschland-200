import type { GeocodingProvider, GeoTreffer } from './GeocodingProvider'

// Geocoding über Nominatim (OpenStreetMap). Kostenlos; für Produktion idealer-
// weise eigene Instanz (NOMINATIM_BASE_URL). Die Policy verlangt einen
// aussagekräftigen User-Agent mit Kontakt.
export class NominatimGeocoder implements GeocodingProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string,
    private readonly timeoutMs = 5000,
  ) {}

  async geocode(query: string): Promise<GeoTreffer | null> {
    const base = this.baseUrl.replace(/\/+$/, '')
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
      countrycodes: 'de', // Pilot: auf Deutschland beschränken
    })
    const url = `${base}/search?${params.toString()}`

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
    let res: Response
    try {
      res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': this.userAgent, 'Accept-Language': 'de' },
      })
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) throw new Error(`Nominatim-Antwort ${res.status}`)
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>
    if (!Array.isArray(data) || data.length === 0) return null

    // Datensparsam auf ~110 m runden (3 Nachkommastellen): genau genug fürs
    // Matching, vermeidet aber das Pinpointen einer konkreten Wohnung.
    const round = (n: number) => Math.round(n * 1000) / 1000
    const r = data[0]
    return {
      lat: round(parseFloat(r.lat)),
      lng: round(parseFloat(r.lon)),
      displayName: r.display_name,
    }
  }
}
