import { describe, it, expect } from 'vitest'
import { LocalSearchTourOptimizer } from './tourOptimizer'
import type { RoutingProvider } from '@/server/routing/RoutingProvider'
import type { Tour } from '@/shared/domain'

// Stub-Routing mit fester Matrix (Golden-Set). Punktreihenfolge: [start, E1, E2, E3].
// Symmetrisch, Rückweg zum Depot (Index 0).
//      0    1    2    3
// 0 [  0,  30,  10,  20 ]
// 1 [ 30,   0,  20,  10 ]
// 2 [ 10,  20,   0,  10 ]
// 3 [ 20,  10,  10,   0 ]
const MATRIX = [
  [0, 30, 10, 20],
  [30, 0, 20, 10],
  [10, 20, 0, 10],
  [20, 10, 10, 0],
]
const stub: RoutingProvider = { async travelMatrix() { return MATRIX } }

const g = (n: number) => ({ lat: 48 + n / 1000, lng: 7.8 + n / 1000 })
const weit = { von: 0, bis: 1439 }
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function tour(over: Partial<Tour> = {}): Tour {
  return {
    id: 'T1',
    tenantId: 'demo',
    datum: '2026-07-25',
    pflegekraftId: 'pk-001',
    pflegekraftQualifikation: ['grundpflege'],
    start: g(0),
    startZeit: 480,
    einsaetze: [
      { pseudonymId: uid(1), geo: g(1), zeitfenster: weit, dauerMin: 30, qualifikation: [] },
      { pseudonymId: uid(2), geo: g(2), zeitfenster: weit, dauerMin: 30, qualifikation: [] },
      { pseudonymId: uid(3), geo: g(3), zeitfenster: weit, dauerMin: 30, qualifikation: [] },
    ],
    ...over,
  }
}

const optimizer = new LocalSearchTourOptimizer()

describe('LocalSearchTourOptimizer', () => {
  it('sortiert eine schlechte Reihenfolge auf das Optimum um', async () => {
    // Eingangsreihenfolge E1,E2,E3 = 0→1→2→3→0 = 30+20+10+20 = 80 (schlecht).
    // Optimum ist 60 (mehrere gleichwertige Permutationen).
    const res = await optimizer.optimiere(tour(), stub)
    expect(res.machbar).toBe(true)
    expect(res.fahrzeitMin).toBe(60)
    expect(res.einsaetze).toHaveLength(3)
  })

  it('findet eine machbare Reihenfolge, wenn ein enges Zeitfenster sie erzwingt', async () => {
    // E2 (nächster Stopp am Depot) muss bis 8:40 (520) beginnen → als Erstes.
    // Die Eingangsreihenfolge (E2 an Position 2) ist unmachbar.
    const eng = tour({
      einsaetze: [
        { pseudonymId: uid(1), geo: g(1), zeitfenster: weit, dauerMin: 30, qualifikation: [] },
        { pseudonymId: uid(2), geo: g(2), zeitfenster: { von: 0, bis: 520 }, dauerMin: 30, qualifikation: [] },
        { pseudonymId: uid(3), geo: g(3), zeitfenster: weit, dauerMin: 30, qualifikation: [] },
      ],
    })
    const res = await optimizer.optimiere(eng, stub)
    expect(res.machbar).toBe(true)
    // Der Stopp mit dem engen Fenster steht vorn.
    expect(res.einsaetze[0].pseudonymId).toBe(uid(2))
  })

  it('gibt eine leere Tour unverändert und machbar zurück', async () => {
    const res = await optimizer.optimiere(tour({ einsaetze: [] }), stub)
    expect(res.machbar).toBe(true)
    expect(res.einsaetze).toHaveLength(0)
    expect(res.fahrzeitMin).toBe(0)
  })

  it('lässt eine Tour mit nur einem Einsatz unverändert', async () => {
    const eins = tour({ einsaetze: [tour().einsaetze[1]] })
    const res = await optimizer.optimiere(eins, stub)
    expect(res.machbar).toBe(true)
    expect(res.einsaetze).toHaveLength(1)
    expect(res.einsaetze[0].pseudonymId).toBe(uid(2))
  })
})
