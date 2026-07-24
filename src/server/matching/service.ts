import type { RoutingProvider } from '@/server/routing/RoutingProvider'
import { waehleRoutingKern } from '@/server/routing/waehleRouting'
import { CachedRoutingProvider, InMemoryMatrixCache } from './matrixCache'
import { fitScore, qualifikationErfuellt, ARBZG, besuchsdauer } from './fitScore'
import { LocalSearchTourOptimizer } from './tourOptimizer'
import { env } from '@/lib/env'
import type { FitScoreRequest, FitMatch, Tour } from '@/shared/domain'

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

// Plant eine Tour: berechnet je Einsatz die Ankunftszeit und liefert
// zusätzlich die Kennzahlen (Gesamtfahrzeit, Auslastung, Arbeitszeit,
// ArbZG-Konformität). Berücksichtigt die Pflichtpause nach 6 h (§4 ArbZG)
// im Zeitplan. Wird nach dem Aufnehmen eines Klienten aufgerufen.
export async function planeTour(tour: Tour): Promise<{
  einsaetze: Tour['einsaetze']
  fahrzeitMin: number
  pflegezeitMin: number
  grundzeitMin: number
  auslastungProzent: number
  arbeitszeitMin: number
  arbzgKonform: boolean
}> {
  const punkte = [tour.start, ...tour.einsaetze.map((e) => e.geo)]
  // Endpunkt (Pflichtenheft 5.1.2): Rückweg dorthin zählt zu Fahr-/Arbeitszeit.
  // Ohne separaten `ende` ist das der Startpunkt (Index 0, Rundtour zum Depot).
  let endeIdx = 0
  if (tour.ende) {
    punkte.push(tour.ende)
    endeIdx = punkte.length - 1
  }
  const matrix = await routing.travelMatrix(punkte)

  let t = tour.startZeit
  let fahrzeit = 0
  let pflege = 0 // reine Leistungszeit (Pflichtenheft 5.1.3: getrennt von Grundzeit)
  let grundzeit = 0 // Hausbesuchsgrundzeit, separat ausgewiesen
  let arbeit = 0 // Arbeitszeit = Fahrt + Leistung + Grundzeit (ohne Warte-/Pausenzeit)
  let pauseGesetzt = false
  const einsaetze = tour.einsaetze.map((e, i) => {
    const reise = matrix[i][i + 1] // von vorherigem Punkt zu diesem Einsatz
    fahrzeit += reise
    arbeit += reise
    let ankunft = t + reise
    // ArbZG §4: nach 6 h Arbeit einmalig 30 min Pause einschieben.
    if (!pauseGesetzt && arbeit >= ARBZG.schwelle6hMin) {
      ankunft += ARBZG.pauseNach6hMin
      pauseGesetzt = true
    }
    const beginn = Math.max(ankunft, e.zeitfenster.von)
    const grund = e.grundzeitMin ?? 0
    const dauer = besuchsdauer(e.dauerMin, e.grundzeitMin) // Leistung + Grundzeit
    t = beginn + dauer
    pflege += e.dauerMin
    grundzeit += grund
    arbeit += dauer
    return { ...e, ankunft: Math.round(ankunft) }
  })

  // Rückweg vom letzten Stopp zum Endpunkt (Depot oder separater Tour-Endpunkt).
  const letzterIdx = tour.einsaetze.length // 0=Start, 1..n=Einsätze
  const rueckweg = matrix[letzterIdx][endeIdx]
  fahrzeit += rueckweg
  arbeit += rueckweg

  // Auslastung = Zeit am Klienten (Leistung + Grundzeit) / (davon + Fahrzeit),
  // grob als Effizienzmaß. Grundzeit ist echte Zeit beim Patienten, zählt also
  // zur produktiven Seite; sie wird zusätzlich separat ausgewiesen.
  const amKlienten = pflege + grundzeit
  const gesamt = amKlienten + fahrzeit
  const auslastung = gesamt > 0 ? Math.round((amKlienten / gesamt) * 100) : 0
  return {
    einsaetze,
    fahrzeitMin: Math.round(fahrzeit),
    pflegezeitMin: Math.round(pflege),
    grundzeitMin: Math.round(grundzeit),
    auslastungProzent: auslastung,
    arbeitszeitMin: Math.round(arbeit),
    arbzgKonform: arbeit <= ARBZG.maxArbeitszeitMin,
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
