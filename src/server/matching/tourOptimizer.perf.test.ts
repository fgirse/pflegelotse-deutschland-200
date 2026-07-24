import { describe, it, expect } from 'vitest'
import { LocalSearchTourOptimizer } from './tourOptimizer'
import { HaversineRoutingProvider } from '@/server/routing/HaversineRoutingProvider'
import { CachedRoutingProvider, InMemoryMatrixCache } from './matrixCache'
import type { Tour } from '@/shared/domain'

// Pflichtenheft 6.1: Optimierung für 200 Bedarfe × 50 Mitarbeiter in ≤ 60 s.
// Für das Single-Tour-Sequencing (2.1) ist die relevante Last: 50 Touren
// optimieren (200 Stopps auf 50 Touren ≈ 4 je Tour). Zusätzlich messen wir eine
// große Einzeltour, weil die Kosten der lokalen Suche mit der Stopp-Zahl JE Tour
// wachsen (O(n³) pro Durchlauf), nicht mit der Zahl der Touren.

function geoAus(i: number): { lat: number; lng: number } {
  return { lat: 47.95 + (i % 20) * 0.005, lng: 7.75 + Math.floor(i / 20) * 0.005 }
}
const weit = { von: 0, bis: 1439 }
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function baueTour(id: number, stopps: number, seed: number): Tour {
  return {
    id: `T${id}`,
    tenantId: 'demo',
    datum: '2026-07-25',
    pflegekraftId: `pk-${id}`,
    pflegekraftQualifikation: ['grundpflege'],
    start: geoAus(seed),
    startZeit: 480,
    einsaetze: Array.from({ length: stopps }, (_, k) => ({
      pseudonymId: uid(seed * 100 + k),
      geo: geoAus(seed + 1 + k),
      zeitfenster: weit,
      dauerMin: 30,
      qualifikation: [] as string[],
    })),
  }
}

const optimizer = new LocalSearchTourOptimizer()

describe('TourOptimizer Performance (Pflichtenheft 6.1)', () => {
  it('optimiert 50 Touren (200 Stopps gesamt) deutlich unter 60 s', async () => {
    const routing = new CachedRoutingProvider(new HaversineRoutingProvider(), new InMemoryMatrixCache())
    const touren = Array.from({ length: 50 }, (_, i) => baueTour(i, 4, i * 10))

    const start = performance.now()
    for (const tour of touren) {
      await optimizer.optimiere(tour, routing)
    }
    const dauerMs = performance.now() - start

    console.log(`[perf] 50 Touren × 4 Stopps optimiert in ${dauerMs.toFixed(0)} ms`)
    expect(dauerMs).toBeLessThan(20000) // großzügiger Regressions-Guard (§6.1: 60 s)
  }, 60000)

  it('optimiert eine große Einzeltour (15 Stopps) schnell', async () => {
    const routing = new CachedRoutingProvider(new HaversineRoutingProvider(), new InMemoryMatrixCache())
    const gross = baueTour(99, 15, 500)

    const start = performance.now()
    const res = await optimizer.optimiere(gross, routing)
    const dauerMs = performance.now() - start

    console.log(`[perf] 1 Tour × 15 Stopps optimiert in ${dauerMs.toFixed(0)} ms`)
    expect(res.machbar).toBe(true)
    expect(dauerMs).toBeLessThan(10000) // weit unter der 60-s-Vorgabe
  }, 60000)
})
