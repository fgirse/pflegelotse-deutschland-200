import { describe, it, expect } from 'vitest'
import { fitScore } from './fitScore'
import { HaversineRoutingProvider } from '@/server/routing/HaversineRoutingProvider'
import { CachedRoutingProvider, InMemoryMatrixCache } from './matrixCache'
import type { Tour, FitScoreRequest } from '@/shared/domain'

// Pflichtenheft 6.1: Die Routenoptimierung für einen Dienst mit bis zu 200
// Bedarfen und 50 Mitarbeitern muss in ≤ 60 s abgeschlossen sein. Dieser
// Benchmark misst die Fit-Score-Bewertung von 200 Kandidaten gegen 50 Touren
// mit gecachter Reisezeit-Matrix und dient als Regressions-Guard in CI.

// Deterministische Koordinate aus einem Index — kein Zufall (Math.random ist im
// Test-Runner gesperrt und würde die Reproduzierbarkeit brechen).
function geoAus(i: number): { lat: number; lng: number } {
  return { lat: 47.95 + (i % 20) * 0.005, lng: 7.75 + Math.floor(i / 20) * 0.005 }
}
const weit = { von: 0, bis: 1439 }

function baueTouren(anzahl: number): Tour[] {
  const touren: Tour[] = []
  for (let t = 0; t < anzahl; t++) {
    const einsaetze = Array.from({ length: 4 }, (_, k) => ({
      pseudonymId: `00000000-0000-4000-8000-${String(t * 4 + k).padStart(12, '0')}`,
      geo: geoAus(t * 4 + k),
      zeitfenster: weit,
      dauerMin: 30,
      qualifikation: [] as string[],
    }))
    touren.push({
      id: `T${t}`,
      tenantId: 'demo',
      datum: '2026-07-24',
      pflegekraftId: `pk-${t}`,
      pflegekraftQualifikation: ['grundpflege'],
      start: geoAus(1000 + t),
      startZeit: 480,
      einsaetze,
    })
  }
  return touren
}

function baueKandidaten(anzahl: number): FitScoreRequest['kandidat'][] {
  return Array.from({ length: anzahl }, (_, i) => ({
    geo: geoAus(2000 + i),
    zeitfenster: weit,
    dauerMin: 30,
    qualifikation: [] as string[],
  }))
}

describe('Fit-Score Performance (Pflichtenheft 6.1)', () => {
  it('bewertet 200 Kandidaten gegen 50 Touren deutlich unter 60 s', async () => {
    const routing = new CachedRoutingProvider(new HaversineRoutingProvider(), new InMemoryMatrixCache())
    const touren = baueTouren(50)
    const kandidaten = baueKandidaten(200)

    const start = performance.now()
    for (const k of kandidaten) {
      await fitScore(touren, k, routing)
    }
    const dauerMs = performance.now() - start

    // Gemessene Zeit im CI-Log dokumentieren.
    console.log(`[perf] 200×50 Fit-Score in ${dauerMs.toFixed(0)} ms`)
    // Großzügiger Regressions-Guard, weit unter der 60-s-Vorgabe (§6.1).
    expect(dauerMs).toBeLessThan(20000)
  }, 60000)
})
