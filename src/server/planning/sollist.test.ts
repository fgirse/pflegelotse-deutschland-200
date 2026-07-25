import { describe, it, expect } from 'vitest'
import { sollIst } from './sollist'
import type { RoutingProvider } from '@/server/routing/RoutingProvider'
import type { Tour } from '@/shared/domain'

// Punkte [start, E1, E2]; Rückweg zum Start (Index 0).
const MATRIX = [
  [0, 10, 10],
  [10, 0, 10],
  [10, 10, 0],
]
const stub: RoutingProvider = { async travelMatrix() { return MATRIX } }

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const g = (n: number) => ({ lat: 48 + n / 1000, lng: 7.8 + n / 1000 })
const weit = { von: 0, bis: 1439 }

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
    ],
    ...over,
  }
}

describe('sollIst', () => {
  it('weist Abweichungen aus und markiert Ausreißer über der Schwelle', async () => {
    // Soll: E1 kommt 490 (8:10), E2 kommt 530 (8:50). Ist: E1 pünktlich (495,
    // +5 → ok), E2 stark verspätet (560, +30 → Ausreißer bei Schwelle 15).
    const t = tour({
      einsaetze: [
        { pseudonymId: uid(1), geo: g(1), zeitfenster: weit, dauerMin: 30, qualifikation: [], istAnkunft: 495 },
        { pseudonymId: uid(2), geo: g(2), zeitfenster: weit, dauerMin: 30, qualifikation: [], istAnkunft: 560 },
      ],
    })
    const bericht = await sollIst(t, stub)

    expect(bericht.stopps[0]).toMatchObject({ sollAnkunft: 490, istAnkunft: 495, abweichungMin: 5, ausreisser: false })
    expect(bericht.stopps[1]).toMatchObject({ sollAnkunft: 530, istAnkunft: 560, abweichungMin: 30, ausreisser: true })
    expect(bericht.erfasst).toBe(2)
    expect(bericht.puenktlich).toBe(1)
    expect(bericht.puenktlichkeitProzent).toBe(50)
    expect(bericht.maxAbweichungMin).toBe(30)
  })

  it('zählt nicht erfasste Stopps nicht mit (Abweichung null)', async () => {
    // Nur E1 erfasst, E2 offen.
    const t = tour({
      einsaetze: [
        { pseudonymId: uid(1), geo: g(1), zeitfenster: weit, dauerMin: 30, qualifikation: [], istAnkunft: 492 },
        { pseudonymId: uid(2), geo: g(2), zeitfenster: weit, dauerMin: 30, qualifikation: [] },
      ],
    })
    const bericht = await sollIst(t, stub)

    expect(bericht.stopps[1].abweichungMin).toBeNull()
    expect(bericht.erfasst).toBe(1)
    expect(bericht.puenktlichkeitProzent).toBe(100)
  })

  it('liefert puenktlichkeitProzent=null, wenn nichts erfasst ist', async () => {
    const bericht = await sollIst(tour(), stub)
    expect(bericht.erfasst).toBe(0)
    expect(bericht.puenktlichkeitProzent).toBeNull()
    expect(bericht.maxAbweichungMin).toBeNull()
  })
})
