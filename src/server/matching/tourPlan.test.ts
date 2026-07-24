import { describe, it, expect } from 'vitest'
import { planeAblauf } from './tourPlan'
import type { RoutingProvider } from '@/server/routing/RoutingProvider'
import type { Tour } from '@/shared/domain'

// Punkte [start, E1, E2]; Rückweg zum Start (Index 0).
//      0    1    2
// 0 [  0,  10,  10 ]
// 1 [ 10,   0,  50 ]
// 2 [ 10,  50,   0 ]
const MATRIX = [
  [0, 10, 10],
  [10, 0, 50],
  [10, 50, 0],
]
const stub: RoutingProvider = { async travelMatrix() { return MATRIX } }

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const g = (n: number) => ({ lat: 48 + n / 1000, lng: 7.8 + n / 1000 })

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
      { pseudonymId: uid(1), geo: g(1), zeitfenster: { von: 0, bis: 1439 }, dauerMin: 30, qualifikation: [] },
      { pseudonymId: uid(2), geo: g(2), zeitfenster: { von: 0, bis: 530 }, dauerMin: 30, qualifikation: [] },
    ],
    ...over,
  }
}

describe('planeAblauf', () => {
  it('markiert einen Stopp als Zeitfenster-verletzt, ohne die Rechnung abzubrechen', async () => {
    // E1 (8:10), dann E2: Ankunft 520 + Reise 50 = 570 > 530 → verletzt.
    const plan = await planeAblauf(tour(), stub)
    expect(plan.stops).toHaveLength(2)
    expect(plan.stops[0]).toMatchObject({ pseudonymId: uid(1), ankunft: 490, zeitfensterOk: true })
    expect(plan.stops[1]).toMatchObject({ pseudonymId: uid(2), ankunft: 570, zeitfensterOk: false })
    // Fahrzeit inkl. Rückweg 2→0: 10 + 50 + 10 = 70.
    expect(plan.fahrzeitMin).toBe(70)
  })

  it('meldet alle Stopps als ok, wenn die Reihenfolge die Fenster einhält', async () => {
    // E2 zuerst (Ankunft 490 ≤ 530), dann E1 (weit).
    const umgekehrt = tour({
      einsaetze: [tour().einsaetze[1], tour().einsaetze[0]],
    })
    const plan = await planeAblauf(umgekehrt, stub)
    expect(plan.stops.every((s) => s.zeitfensterOk)).toBe(true)
  })
})
