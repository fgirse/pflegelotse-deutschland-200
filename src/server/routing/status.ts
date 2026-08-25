import type { RoutingKonfig } from './waehleRouting'
import { waehleRoutingKern } from './waehleRouting'
import { FallbackRoutingProvider } from './FallbackRoutingProvider'
import { meldeDegradierung, type DegradierungsGrund } from './degradierung'
import type { Geo } from '@/shared/domain'

// ── Betriebsstatus des Routings ──────────────────────────────────────────
// Beantwortet die für den Disponenten entscheidende Frage: Beruhen die
// angezeigten Fahrzeiten auf echten Straßen — oder nur auf Luftlinie?
//
// Die Antwort ist nicht aus der Konfiguration allein ableitbar: Ein sauber
// konfigurierter OSRM-Server kann ausgefallen sein, und der Fallback rechnet
// dann klaglos weiter. Deshalb prüft `pruefeRouting()` aktiv mit einer winzigen
// Testanfrage nach — gegen den PRIMÄREN Provider, nicht durch den Fallback
// hindurch (der würde den Fehler ja gerade verschlucken).

export type RoutingModus = 'strasse' | 'luftlinie'

export type RoutingStatus = {
  modus: RoutingModus
  provider: RoutingKonfig['provider']
  // Nur bei modus='luftlinie' gesetzt — warum es keine echten Fahrzeiten gibt.
  grund?: DegradierungsGrund
}

// Ergebnis der aktiven Testanfrage. 'entfaellt' = gar kein Straßen-Provider
// konfiguriert, es gibt nichts zu prüfen.
export type ProbeErgebnis = 'ok' | 'fehler' | 'entfaellt'

// Zwei nahe beieinanderliegende Punkte in Berlin. Bewusst ein fixes, minimales
// Paar: eine 2×2-Matrix ist die billigste sinnvolle Anfrage und enthält keine
// Klientendaten (kein PII-Abfluss an den Routing-Server durch den Check).
export const PROBE_PUNKTE: [Geo, Geo] = [
  { lat: 52.5200, lng: 13.4050 },
  { lat: 52.4996, lng: 13.4030 },
]

// Zeitlimit der Testanfrage. Kürzer als das Provider-Timeout (4 s), damit ein
// hängender Routing-Server das Dashboard-Rendering nicht spürbar aufhält.
export const PROBE_TIMEOUT_MS = 2500

// Wie lange ein Ergebnis gilt. Ein gesunder Zustand darf länger stehen; nach
// einer Störung fragen wir häufiger nach, damit die Erholung schnell sichtbar
// wird.
export const CACHE_OK_MS = 60_000
export const CACHE_FEHLER_MS = 20_000

// Ist für den gewählten Provider überhaupt alles Nötige gesetzt? Rein.
export function istKonfiguriert(cfg: RoutingKonfig): boolean {
  if (cfg.provider === 'osrm') return Boolean(cfg.osrmBaseUrl)
  if (cfg.provider === 'here') return Boolean(cfg.hereApiKey)
  return false // 'haversine' ist kein Straßen-Provider
}

// Reine Bewertung: Konfiguration + Probe-Ergebnis → Status. Ohne I/O, damit die
// Fallunterscheidung testbar bleibt.
export function bewerteRouting(cfg: RoutingKonfig, probe: ProbeErgebnis): RoutingStatus {
  if (cfg.provider === 'haversine') {
    return { modus: 'luftlinie', provider: 'haversine', grund: 'nichtKonfiguriert' }
  }
  if (!istKonfiguriert(cfg)) {
    return { modus: 'luftlinie', provider: cfg.provider, grund: 'fehlkonfiguriert' }
  }
  if (probe === 'fehler') {
    return { modus: 'luftlinie', provider: cfg.provider, grund: 'nichtErreichbar' }
  }
  return { modus: 'strasse', provider: cfg.provider }
}

// Führt die Testanfrage gegen den primären Provider aus. Liefert 'ok'/'fehler',
// wirft nie — ein Statuscheck darf den Aufrufer nicht scheitern lassen.
async function probiere(cfg: RoutingKonfig): Promise<ProbeErgebnis> {
  if (!istKonfiguriert(cfg)) return 'entfaellt'
  const kern = waehleRoutingKern(cfg)
  // waehleRoutingKern hüllt konfigurierte Straßen-Provider in den Fallback;
  // wir wollen den Primär direkt, sonst maskiert der Ersatz den Ausfall.
  const primaer = kern instanceof FallbackRoutingProvider ? kern.primaer : kern

  const timeout = new Promise<'fehler'>((resolve) =>
    setTimeout(() => resolve('fehler'), PROBE_TIMEOUT_MS),
  )
  const anfrage = primaer
    .travelMatrix([...PROBE_PUNKTE])
    .then((m): ProbeErgebnis => {
      // Plausibilität: eine 2×2-Matrix mit endlicher Fahrzeit zwischen den
      // Punkten. Ein Server, der Unendlich/Unsinn liefert, gilt als gestört.
      const wert = m?.[0]?.[1]
      return typeof wert === 'number' && Number.isFinite(wert) ? 'ok' : 'fehler'
    })
    .catch((): ProbeErgebnis => 'fehler')

  return Promise.race([anfrage, timeout])
}

// Gecachtes Ergebnis (prozessweit, pro Serverless-Instanz).
let cache: { status: RoutingStatus; bis: number } | null = null

// Nur für Tests: Cache leeren.
export function resetStatusCache(): void {
  cache = null
}

// Ermittelt den aktuellen Routing-Status — gecacht, damit weder das Dashboard
// noch der Health-Check bei jedem Aufruf eine Netzanfrage auslöst. Eine
// Degradierung wird zusätzlich (entprellt) ans Monitoring gemeldet.
export async function pruefeRouting(cfg: RoutingKonfig): Promise<RoutingStatus> {
  const jetzt = Date.now()
  if (cache && jetzt < cache.bis) return cache.status

  const status = bewerteRouting(cfg, await probiere(cfg))
  const ttl = status.modus === 'strasse' ? CACHE_OK_MS : CACHE_FEHLER_MS
  cache = { status, bis: jetzt + ttl }

  // 'nichtKonfiguriert' ist eine bewusste Betreiber-Entscheidung (Dev/Pilot)
  // und kein Störfall — die beiden anderen Gründe schon.
  if (status.grund && status.grund !== 'nichtKonfiguriert') {
    meldeDegradierung(status.grund, `Provider ${status.provider}`)
  }
  return status
}
