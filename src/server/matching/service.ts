import type { RoutingProvider } from '@/server/routing/RoutingProvider'
import { waehleRoutingKern } from '@/server/routing/waehleRouting'
import { CachedRoutingProvider, InMemoryMatrixCache } from './matrixCache'
import { fitScore, qualifikationErfuellt, ARBZG, HAUSBESUCH_GRUNDZEIT_MIN } from './fitScore'
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
  const matches = await fitScore(touren, kandidat, routing)
  // Bei keinem Treffer den konkreten Grund bestimmen: gar keine Touren, keine
  // Tour mit passender Qualifikation, oder qualifiziert aber kein Zeitfenster frei.
  let grund: KeinTrefferGrund | null = null
  if (matches.length === 0) {
    if (touren.length === 0) grund = 'keineTouren'
    else if (!touren.some((t) => qualifikationErfuellt(t, kandidat))) grund = 'qualifikation'
    else grund = 'zeitfenster'
  }
  return {
    matches,
    geprueft: touren.length,
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
  auslastungProzent: number
  arbeitszeitMin: number
  arbzgKonform: boolean
}> {
  const punkte = [tour.start, ...tour.einsaetze.map((e) => e.geo)]
  const matrix = await routing.travelMatrix(punkte)

  let t = tour.startZeit
  let fahrzeit = 0
  let pflege = 0
  let arbeit = 0 // Arbeitszeit = Fahrt + Leistung (ohne Warte-/Pausenzeit)
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
    const dauer = e.dauerMin + HAUSBESUCH_GRUNDZEIT_MIN
    t = beginn + dauer
    pflege += dauer
    arbeit += dauer
    return { ...e, ankunft: Math.round(ankunft) }
  })

  // Auslastung = Pflegezeit / (Pflegezeit + Fahrzeit), grob als Effizienzmaß.
  const gesamt = pflege + fahrzeit
  const auslastung = gesamt > 0 ? Math.round((pflege / gesamt) * 100) : 0
  return {
    einsaetze,
    fahrzeitMin: Math.round(fahrzeit),
    auslastungProzent: auslastung,
    arbeitszeitMin: Math.round(arbeit),
    arbzgKonform: arbeit <= ARBZG.maxArbeitszeitMin,
  }
}
