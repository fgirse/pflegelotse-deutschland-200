import type { RoutingProvider } from '@/server/routing/RoutingProvider'
import { waehleRoutingKern } from '@/server/routing/waehleRouting'
import { CachedRoutingProvider, InMemoryMatrixCache } from './matrixCache'
import { fitScore, qualifikationErfuellt } from './fitScore'
import { planeAblauf } from './tourPlan'
import { LocalSearchTourOptimizer } from './tourOptimizer'
import { umverteile } from '@/server/planning/umverteilung'
import { ladeTour, ladeTouren, speichereEinsaetze, aktualisiereTour } from '@/server/repo'
import { env } from '@/lib/env'
import type { FitScoreRequest, FitMatch, Tour, Einsatz } from '@/shared/domain'

// Grund, warum kein Treffer zustande kam (für konkrete UI-Meldung).
export type KeinTrefferGrund = 'keineTouren' | 'qualifikation' | 'zeitfenster'

// Composition Root des Routings: wählt den Adapter (Haversine/OSRM/HERE) anhand
// der Env inkl. Fallback auf Haversine und hüllt ihn in den Matrix-Cache
// (interaktive Antwortzeit). Die Auswahllogik selbst liegt testbar in
// routing/waehleRouting.ts.
function baueRouting(): RoutingProvider {
  const kern = waehleRoutingKern({
    provider: env.ROUTING_PROVIDER,
    osrmBaseUrl: env.OSRM_BASE_URL,
    osrmProfile: env.OSRM_PROFILE,
    osrmApiKey: env.OSRM_API_KEY,
    hereApiKey: env.HERE_API_KEY,
  })
  return new CachedRoutingProvider(kern, new InMemoryMatrixCache())
}

const routing = baueRouting()

// Berechnet den Fit-Score eines Kandidaten gegen mehrere Touren.
export async function berechneFitScore(
  touren: Tour[],
  kandidat: FitScoreRequest['kandidat'],
): Promise<{
  matches: FitMatch[]
  geprueft: number
  rechenzeitMs: number
  grund: KeinTrefferGrund | null
}> {
  const start = performance.now()
  // Nur verfügbare Touren sind buchbar (Urlaub/Krankheit fällt raus, §5.1.2).
  const aktive = touren.filter((t) => t.verfuegbar !== false)
  const matches = await fitScore(aktive, kandidat, routing)
  // Bei keinem Treffer den konkreten Grund bestimmen: gar keine (buchbaren)
  // Touren, keine mit passender Qualifikation, oder qualifiziert aber kein
  // Zeitfenster frei.
  let grund: KeinTrefferGrund | null = null
  if (matches.length === 0) {
    if (aktive.length === 0) grund = 'keineTouren'
    else if (!aktive.some((t) => qualifikationErfuellt(t, kandidat))) grund = 'qualifikation'
    else grund = 'zeitfenster'
  }
  return {
    matches,
    geprueft: aktive.length,
    rechenzeitMs: Math.round((performance.now() - start) * 10) / 10,
    grund,
  }
}

// Plant eine Tour: berechnet je Einsatz die Ankunftszeit und liefert die
// Kennzahlen (Gesamtfahrzeit, Auslastung, Arbeitszeit, ArbZG-Konformität) sowie
// je Stopp den Zeitfenster-Status. Die reine Rechnung liegt in tourPlan.ts
// (dort mit injizierbarem Routing testbar); hier nur die Bindung an den
// aktiven Provider.
export async function planeTour(tour: Tour) {
  return planeAblauf(tour, routing)
}

// Bewertet eine vom Disponenten per Drag&Drop gewählte Reihenfolge (§5.2.3):
// ordnet die Einsätze der Tour nach den übergebenen pseudonymIds um, plant den
// Ablauf und liefert Kennzahlen + je Stopp den Zeitfenster-Status. Mit
// persist=true wird die neue Reihenfolge gespeichert (sonst nur Vorschau).
// Rückgabe: null = Tour nicht gefunden; { ungueltig: true } = Reihenfolge passt
// nicht zur Tour (fehlende/fremde Stopps).
export async function planeReihenfolge(
  tenantId: string,
  tourId: string,
  reihenfolge: string[],
  persist: boolean,
) {
  const tour = await ladeTour(tourId)
  if (!tour || tour.tenantId !== tenantId) return null

  // Einsätze nach der gewünschten Reihenfolge sortieren; nur echte, vollständige
  // Permutationen der vorhandenen Stopps zulassen.
  const nachId = new Map(tour.einsaetze.map((e) => [e.pseudonymId, e]))
  const neu = reihenfolge.map((id) => nachId.get(id)).filter((e): e is Einsatz => Boolean(e))
  if (neu.length !== tour.einsaetze.length) return { ungueltig: true as const }

  const geplant = await planeAblauf({ ...tour, einsaetze: neu }, routing)
  if (persist) await speichereEinsaetze(tourId, geplant.einsaetze)

  return {
    fahrzeitMin: geplant.fahrzeitMin,
    arbeitszeitMin: geplant.arbeitszeitMin,
    auslastungProzent: geplant.auslastungProzent,
    arbzgKonform: geplant.arbzgKonform,
    stops: geplant.stops,
    gespeichert: persist,
  }
}

const tourOptimizer = new LocalSearchTourOptimizer()

// Optimiert die Reihenfolge der Stopps einer Tour (VRPTW-Sequencing, §5.2.1) und
// liefert die neu sortierten Einsätze samt Kennzahlen (Ankunftszeiten,
// Fahrzeit, Auslastung, ArbZG). Verplant die optimierte Reihenfolge über
// planeTour, damit Kennzahlen und Ankunftszeiten konsistent sind.
export async function optimiereTour(tour: Tour): Promise<
  Awaited<ReturnType<typeof planeTour>> & { machbar: boolean }
> {
  const opt = await tourOptimizer.optimiere(tour, routing)
  const geplant = await planeTour({ ...tour, einsaetze: opt.einsaetze })
  return { ...geplant, machbar: opt.machbar }
}

// ── Kurzfristige Umplanung (Pflichtenheft 5.2.2) ──────────────────────────

// Vorschau: berechnet die Umverteilung der Einsätze einer (auszufallenden) Tour
// auf die anderen verfügbaren Touren des Tages — OHNE zu schreiben. Liefert die
// Zuordnungen, die nicht Platzierbaren und die Auswirkung (Mehrfahrzeit je Tour).
export async function planeUmverteilung(tenantId: string, tourId: string) {
  const quelle = await ladeTour(tourId)
  if (!quelle || quelle.tenantId !== tenantId) return null
  const ziele = (await ladeTouren(tenantId, quelle.datum)).filter((t) => t.id !== tourId)
  const res = await umverteile(quelle.einsaetze, ziele, routing)

  const betroffen = new Set(res.zuordnungen.map((z) => z.zielTourId))
  const impact: {
    tourId: string
    pflegekraftId: string
    fahrzeitVorherMin: number
    fahrzeitNachherMin: number
  }[] = []
  for (const original of ziele) {
    if (!betroffen.has(original.id)) continue
    const neu = res.zielTouren.find((t) => t.id === original.id)!
    const [vor, nach] = await Promise.all([planeTour(original), planeTour(neu)])
    impact.push({
      tourId: original.id,
      pflegekraftId: original.pflegekraftId,
      fahrzeitVorherMin: vor.fahrzeitMin,
      fahrzeitNachherMin: nach.fahrzeitMin,
    })
  }
  return { datum: quelle.datum, zuordnungen: res.zuordnungen, nichtPlatzierbar: res.nichtPlatzierbar, impact }
}

// Anwenden: verteilt die Einsätze real um (persistiert die Zieltouren), setzt die
// Quelltour auf verfuegbar=false und behält dort nur die nicht platzierbaren
// Einsätze (keine stillen Verluste — sie bleiben für die manuelle Klärung sichtbar).
export async function wendeUmverteilungAn(tenantId: string, tourId: string) {
  const quelle = await ladeTour(tourId)
  if (!quelle || quelle.tenantId !== tenantId) return null
  const ziele = (await ladeTouren(tenantId, quelle.datum)).filter((t) => t.id !== tourId)
  const res = await umverteile(quelle.einsaetze, ziele, routing)

  const betroffen = new Set(res.zuordnungen.map((z) => z.zielTourId))
  for (const t of res.zielTouren) {
    if (!betroffen.has(t.id)) continue
    const geplant = await planeTour(t)
    await speichereEinsaetze(t.id, geplant.einsaetze)
  }

  const offen = new Set(res.nichtPlatzierbar.map((n) => n.pseudonymId))
  const rest = quelle.einsaetze.filter((e) => offen.has(e.pseudonymId))
  await aktualisiereTour(tourId, { einsaetze: rest, verfuegbar: false })

  return { zuordnungen: res.zuordnungen, nichtPlatzierbar: res.nichtPlatzierbar }
}
