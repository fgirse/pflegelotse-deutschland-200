import { HaversineRoutingProvider } from '@/server/routing/HaversineRoutingProvider'
import { OsrmRoutingProvider } from '@/server/routing/OsrmRoutingProvider'
import { FallbackRoutingProvider } from '@/server/routing/FallbackRoutingProvider'
import type { RoutingProvider } from '@/server/routing/RoutingProvider'
import { CachedRoutingProvider, InMemoryMatrixCache } from './matrixCache'
import { fitScore } from './fitScore'
import { env } from '@/lib/env'
import type { FitScoreRequest, FitMatch, Tour } from '@/shared/domain'

// Composition Root des Routings: wählt den Adapter anhand der Env. Bei 'osrm'
// echtes Straßenrouting mit Haversine als Sicherheitsnetz; sonst die
// Heuristik. Alles wird in den Matrix-Cache gehüllt (interaktive Antwort).
function baueRouting(): RoutingProvider {
  const haversine = new HaversineRoutingProvider()
  let inner: RoutingProvider = haversine
  if (env.ROUTING_PROVIDER === 'osrm' && env.OSRM_BASE_URL) {
    const osrm = new OsrmRoutingProvider(
      env.OSRM_BASE_URL,
      env.OSRM_PROFILE,
      env.OSRM_API_KEY,
    )
    inner = new FallbackRoutingProvider(osrm, haversine)
  }
  return new CachedRoutingProvider(inner, new InMemoryMatrixCache())
}

const routing = baueRouting()

// Berechnet den Fit-Score eines Kandidaten gegen mehrere Touren.
export async function berechneFitScore(
  touren: Tour[],
  kandidat: FitScoreRequest['kandidat'],
): Promise<{ matches: FitMatch[]; geprueft: number; rechenzeitMs: number }> {
  const start = performance.now()
  const matches = await fitScore(touren, kandidat, routing)
  return {
    matches,
    geprueft: touren.length,
    rechenzeitMs: Math.round((performance.now() - start) * 10) / 10,
  }
}

// Plant eine Tour: berechnet je Einsatz die Ankunftszeit und liefert
// zusätzlich die Kennzahlen (Gesamtfahrzeit, Auslastung in Prozent der
// verfügbaren Zeit). Wird nach dem Aufnehmen eines Klienten aufgerufen.
export async function planeTour(tour: Tour): Promise<{
  einsaetze: Tour['einsaetze']
  fahrzeitMin: number
  auslastungProzent: number
}> {
  const punkte = [tour.start, ...tour.einsaetze.map((e) => e.geo)]
  const matrix = await routing.travelMatrix(punkte)

  let t = tour.startZeit
  let fahrzeit = 0
  let pflege = 0
  const einsaetze = tour.einsaetze.map((e, i) => {
    const reise = matrix[i][i + 1] // von vorherigem Punkt zu diesem Einsatz
    fahrzeit += reise
    const ankunft = t + reise
    const beginn = Math.max(ankunft, e.zeitfenster.von)
    t = beginn + e.dauerMin
    pflege += e.dauerMin
    return { ...e, ankunft: Math.round(ankunft) }
  })

  // Auslastung = Pflegezeit / (Pflegezeit + Fahrzeit), grob als Effizienzmaß.
  const gesamt = pflege + fahrzeit
  const auslastung = gesamt > 0 ? Math.round((pflege / gesamt) * 100) : 0
  return { einsaetze, fahrzeitMin: Math.round(fahrzeit), auslastungProzent: auslastung }
}
