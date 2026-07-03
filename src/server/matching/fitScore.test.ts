import { describe, it, expect } from 'vitest'
import { fitScoreFuerTour, fitScore, ARBZG } from './fitScore'
import type { RoutingProvider } from '@/server/routing/RoutingProvider'
import type { Tour, FitScoreRequest } from '@/shared/domain'

// Stub-Routing mit fester, handverifizierter Reisezeit-Matrix (Golden-Set).
// Punktreihenfolge im Fit-Score: [start, E1, E2, kandidat].
//      0    1    2    3
// 0 [  0,  10,  20,  15 ]
// 1 [ 10,   0,  10,   5 ]
// 2 [ 20,  10,   0,   5 ]
// 3 [ 15,   5,   5,   0 ]
const GOLDEN_MATRIX = [
  [0, 10, 20, 15],
  [10, 0, 10, 5],
  [20, 10, 0, 5],
  [15, 5, 5, 0],
]
const stubRouting: RoutingProvider = {
  async travelMatrix() {
    return GOLDEN_MATRIX
  },
}

// Geo-Werte sind hier irrelevant (das Stub-Routing ignoriert sie), müssen aber
// gültig sein. Zeitfenster zunächst weit.
const g = (n: number) => ({ lat: 48 + n / 1000, lng: 7.8 + n / 1000 })
const weit = { von: 0, bis: 1439 }

function basisTour(overrides: Partial<Tour> = {}): Tour {
  return {
    id: 'T1',
    tenantId: 'demo',
    datum: '2026-06-25',
    pflegekraftId: 'pk-001',
    pflegekraftQualifikation: ['grundpflege'],
    start: g(0),
    startZeit: 480,
    einsaetze: [
      { pseudonymId: '00000000-0000-4000-8000-000000000001', geo: g(1), zeitfenster: weit, dauerMin: 30, qualifikation: [] },
      { pseudonymId: '00000000-0000-4000-8000-000000000002', geo: g(2), zeitfenster: weit, dauerMin: 30, qualifikation: [] },
    ],
    ...overrides,
  }
}

function kandidat(over: Partial<FitScoreRequest['kandidat']> = {}): FitScoreRequest['kandidat'] {
  return { geo: g(3), zeitfenster: weit, dauerMin: 30, qualifikation: [], ...over }
}

describe('Fit-Score (Golden-Set)', () => {
  it('findet die günstigste Einfügeposition (Mehrweg 0 bei weiten Fenstern)', async () => {
    const match = await fitScoreFuerTour(basisTour(), kandidat(), stubRouting)
    // Basisfahrzeit 0->1->2 = 20. Position 1 (zwischen E1 und E2):
    // 0->1->kand->2 = 10+5+5 = 20 → Mehrweg 0.
    expect(match).not.toBeNull()
    expect(match!.position).toBe(1)
    expect(match!.mehrwegMin).toBe(0)
    expect(match!.qualifikationOk).toBe(true)
  })

  it('respektiert das Zeitfenster: enges Kandidatenfenster erzwingt Position 0', async () => {
    // Kandidat muss bis 8:20 (500) bedient sein. Nur die erste Position ist machbar.
    const match = await fitScoreFuerTour(basisTour(), kandidat({ zeitfenster: { von: 0, bis: 500 } }), stubRouting)
    expect(match).not.toBeNull()
    expect(match!.position).toBe(0)
    // 0->kand->1->2 = 15+5+10 = 30; Basis 20 → Mehrweg 10.
    expect(match!.mehrwegMin).toBe(10)
  })

  it('gibt null zurück, wenn kein Zeitfenster passt', async () => {
    // Kandidat erst ab 8:00 erreichbar (Ankunft frühestens 495), Fenster endet 8:01.
    const match = await fitScoreFuerTour(basisTour(), kandidat({ zeitfenster: { von: 0, bis: 481 } }), stubRouting)
    expect(match).toBeNull()
  })

  it('schließt Touren ohne passende Qualifikation aus', async () => {
    const match = await fitScoreFuerTour(
      basisTour({ pflegekraftQualifikation: ['grundpflege'] }),
      kandidat({ qualifikation: ['behandlungspflege'] }),
      stubRouting,
    )
    expect(match).toBeNull()
  })

  it('ist deterministisch: gleiche Eingabe → gleiches Ergebnis', async () => {
    const a = await fitScoreFuerTour(basisTour(), kandidat(), stubRouting)
    const b = await fitScoreFuerTour(basisTour(), kandidat(), stubRouting)
    expect(a).toEqual(b)
  })
})

// Pflichtenheft 5.2.1: ArbZG als harte Restriktion der Tourenplanung.
describe('Fit-Score (ArbZG-Restriktionen)', () => {
  // Zwei lange Einsätze (je 285 Min) → Basis 570 Min Leistung + 20 Fahrt = 590.
  // Der Kandidat (30 Min) treibt jede Einfügung über 10 h (600 Min) → kein Treffer.
  it('lehnt eine Einfügung ab, die 10 h Arbeitszeit überschreitet (§3 ArbZG)', async () => {
    const tour = basisTour({
      einsaetze: [
        { pseudonymId: '00000000-0000-4000-8000-000000000001', geo: g(1), zeitfenster: weit, dauerMin: 285, qualifikation: [] },
        { pseudonymId: '00000000-0000-4000-8000-000000000002', geo: g(2), zeitfenster: weit, dauerMin: 285, qualifikation: [] },
      ],
    })
    const match = await fitScoreFuerTour(tour, kandidat(), stubRouting)
    expect(match).toBeNull()
  })

  // Knapp darunter (je 270 Min): 540 Leistung + 30 Kandidat + 20 Fahrt = 590 ≤ 600.
  it('erlaubt eine Einfügung knapp unter 10 h und weist die Arbeitszeit aus', async () => {
    const tour = basisTour({
      einsaetze: [
        { pseudonymId: '00000000-0000-4000-8000-000000000001', geo: g(1), zeitfenster: weit, dauerMin: 270, qualifikation: [] },
        { pseudonymId: '00000000-0000-4000-8000-000000000002', geo: g(2), zeitfenster: weit, dauerMin: 270, qualifikation: [] },
      ],
    })
    const match = await fitScoreFuerTour(tour, kandidat(), stubRouting)
    expect(match).not.toBeNull()
    expect(match!.arbeitszeitMin).toBe(590)
    expect(match!.arbeitszeitMin).toBeLessThanOrEqual(ARBZG.maxArbeitszeitMin)
  })

  // Nach 6 h Arbeit wird eine 30-Min-Pflichtpause eingeschoben (§4 ArbZG).
  // Ein Einsatz mit 360 Min zwingt den danach bedienten Kandidaten hinter die
  // Pause → seine Ankunft verschiebt sich um 30 Min (860 → 890).
  it('schiebt nach 6 h eine Pflichtpause ein und verschiebt die Ankunft (§4 ArbZG)', async () => {
    // Asymmetrische Matrix: start→kand teuer (100), erzwingt Kandidat NACH E1.
    const matrix = [
      [0, 10, 100],
      [10, 0, 10],
      [100, 10, 0],
    ]
    const routing: RoutingProvider = { async travelMatrix() { return matrix } }
    const tour = basisTour({
      einsaetze: [{ pseudonymId: '00000000-0000-4000-8000-000000000001', geo: g(1), zeitfenster: weit, dauerMin: 360, qualifikation: [] }],
    })
    const match = await fitScoreFuerTour(tour, kandidat(), routing)
    expect(match).not.toBeNull()
    expect(match!.position).toBe(1)
    // Ohne Pause wäre die Ankunft 860; die 30-Min-Pause verschiebt sie auf 890.
    expect(match!.ankunft).toBe(860 + ARBZG.pauseNach6hMin)
  })
})

// Pflichtenheft 5.2.1: Bezugspflege als weiche Restriktion.
describe('Fit-Score (Bezugspflege, weiche Restriktion)', () => {
  it('reiht die Tour der Wunsch-Pflegekraft nach vorne', async () => {
    const tourA = basisTour({ id: 'T1', pflegekraftId: 'pk-001' })
    const tourB = basisTour({ id: 'T2', pflegekraftId: 'pk-002' })
    const matches = await fitScore([tourA, tourB], kandidat({ bezugspflege: 'pk-002' }), stubRouting)
    expect(matches).toHaveLength(2)
    expect(matches[0].pflegekraftId).toBe('pk-002')
    expect(matches[0].bezugspflegeErfuellt).toBe(true)
    expect(matches[1].bezugspflegeErfuellt).toBe(false)
  })

  it('setzt bezugspflegeErfuellt=false ohne Wunschkraft', async () => {
    const match = await fitScoreFuerTour(basisTour(), kandidat(), stubRouting)
    expect(match!.bezugspflegeErfuellt).toBe(false)
  })
})
