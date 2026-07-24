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

  // Knapp darunter (je 260 Min): 520 Leistung + 30 Kandidat + 40 Fahrt inkl.
  // Rückweg zum Depot (Matrix 2→0 = 20) = 590 ≤ 600.
  it('erlaubt eine Einfügung knapp unter 10 h und weist die Arbeitszeit aus', async () => {
    const tour = basisTour({
      einsaetze: [
        { pseudonymId: '00000000-0000-4000-8000-000000000001', geo: g(1), zeitfenster: weit, dauerMin: 260, qualifikation: [] },
        { pseudonymId: '00000000-0000-4000-8000-000000000002', geo: g(2), zeitfenster: weit, dauerMin: 260, qualifikation: [] },
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
    // Asymmetrische Matrix: start→kand teuer (100) erzwingt Kandidat NACH E1;
    // Rückweg kand→Depot günstig (10), damit die letzte Position gewinnt.
    const matrix = [
      [0, 10, 100],
      [10, 0, 10],
      [10, 10, 0],
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

// Pflichtenheft 5.1.3: Hausbesuchsgrundzeit je Besuch, separat von der reinen
// Leistungszeit. Sie fließt in Zeitplan und ArbZG-Rechnung ein.
describe('Fit-Score (Hausbesuchsgrundzeit)', () => {
  // Basis (Position 1): Fahrzeit 40 inkl. Rückweg + Leistung 3×30 = 130.
  it('addiert die Grundzeit je Besuch auf Arbeitszeit und Ankunft', async () => {
    const ohne = await fitScoreFuerTour(basisTour(), kandidat(), stubRouting)
    expect(ohne!.arbeitszeitMin).toBe(130)
    expect(ohne!.ankunft).toBe(525) // 480 +10 (0→1) +30 (E1) +5 (1→kand)

    // Grundzeit je 10 Min auf E1, E2 und Kandidat → +30 Min Arbeitszeit gesamt.
    const tour = basisTour({
      einsaetze: [
        { pseudonymId: '00000000-0000-4000-8000-000000000001', geo: g(1), zeitfenster: weit, dauerMin: 30, grundzeitMin: 10, qualifikation: [] },
        { pseudonymId: '00000000-0000-4000-8000-000000000002', geo: g(2), zeitfenster: weit, dauerMin: 30, grundzeitMin: 10, qualifikation: [] },
      ],
    })
    const mit = await fitScoreFuerTour(tour, kandidat({ grundzeitMin: 10 }), stubRouting)
    expect(mit!.arbeitszeitMin).toBe(160) // 130 + 3×10
    // Nur die Grundzeit VOR dem Kandidaten (E1: +10) verschiebt dessen Ankunft.
    expect(mit!.ankunft).toBe(535)
    // Position und Mehrweg bleiben, da die Grundzeit nicht in die Fahrzeit zählt.
    expect(mit!.position).toBe(ohne!.position)
    expect(mit!.mehrwegMin).toBe(ohne!.mehrwegMin)
  })

  // Dieselbe Tour, die ohne Grundzeit knapp machbar ist (590 ≤ 600), kippt mit
  // Grundzeit über die 10-h-Grenze (§3 ArbZG) → kein Treffer.
  it('lässt die Grundzeit eine sonst machbare Einfügung über 10 h kippen', async () => {
    const einsaetze = [
      { pseudonymId: '00000000-0000-4000-8000-000000000001', geo: g(1), zeitfenster: weit, dauerMin: 260, qualifikation: [] },
      { pseudonymId: '00000000-0000-4000-8000-000000000002', geo: g(2), zeitfenster: weit, dauerMin: 260, qualifikation: [] },
    ]
    // Ohne Grundzeit: machbar (590 Min).
    const ohne = await fitScoreFuerTour(basisTour({ einsaetze }), kandidat(), stubRouting)
    expect(ohne).not.toBeNull()
    // Kandidat mit 20 Min Grundzeit → 610 Min > 600 → nicht machbar.
    const mit = await fitScoreFuerTour(basisTour({ einsaetze }), kandidat({ grundzeitMin: 20 }), stubRouting)
    expect(mit).toBeNull()
  })
})

// Pflichtenheft 5.2.1: Kapazitätsgrenze je Tour (max. Anzahl Einsätze).
describe('Fit-Score (Kapazität)', () => {
  it('lehnt eine volle Tour ab, obwohl Zeitfenster und ArbZG passen würden', async () => {
    // Zwei Einsätze, Grenze 2 → voll. Ohne die Grenze wäre der Kandidat machbar.
    const voll = basisTour({ maxEinsaetze: 2 }) // basisTour hat 2 Einsätze
    expect(await fitScoreFuerTour(voll, kandidat(), stubRouting)).toBeNull()
    // Gegenprobe: gleiche Tour ohne Grenze nimmt den Kandidaten auf.
    expect(await fitScoreFuerTour(basisTour(), kandidat(), stubRouting)).not.toBeNull()
  })

  it('erlaubt eine Einfügung, solange die Grenze nicht erreicht ist', async () => {
    const platz = basisTour({ maxEinsaetze: 3 }) // 2 Einsätze, Platz für einen dritten
    expect(await fitScoreFuerTour(platz, kandidat(), stubRouting)).not.toBeNull()
  })
})

// Pflichtenheft 5.1.2: Verfügbarkeit der Pflegekraft (Urlaub/Krankheit) und
// Teilzeit-Schichtende begrenzen, welche Touren einplanbar sind.
describe('Fit-Score (Verfügbarkeit / Teilzeit)', () => {
  it('schließt eine an dem Tag nicht verfügbare Tour aus (Urlaub/Krankheit)', async () => {
    const tour = basisTour({ verfuegbar: false })
    // Direkt: keine Position.
    expect(await fitScoreFuerTour(tour, kandidat(), stubRouting)).toBeNull()
    // Über den Fan-out: die Tour taucht nicht in den Treffern auf.
    const matches = await fitScore([tour], kandidat(), stubRouting)
    expect(matches).toHaveLength(0)
  })

  it('lehnt einen Einsatz nach dem Teilzeit-Schichtende ab', async () => {
    // Schichtende 13:00 (780). Kandidat frühestens 14:00 (840) → nicht machbar.
    const tour = basisTour({ verfuegbarBis: 780 })
    const spaet = kandidat({ zeitfenster: { von: 840, bis: 900 } })
    expect(await fitScoreFuerTour(tour, spaet, stubRouting)).toBeNull()
  })

  it('erlaubt einen Einsatz, der vor dem Schichtende abgeschlossen ist', async () => {
    // Schichtende 13:00 (780); Kandidat am Vormittag (weit) → machbar.
    const tour = basisTour({ verfuegbarBis: 780 })
    expect(await fitScoreFuerTour(tour, kandidat(), stubRouting)).not.toBeNull()
  })
})

// Pflichtenheft 5.1.2: die Tour hat einen Endpunkt; der Rückweg vom letzten
// Stopp dorthin zählt zur Fahrzeit und damit zum Mehrweg.
describe('Fit-Score (Tour-Endpunkt / Rückweg)', () => {
  it('rechnet den Rückweg zum Depot in den Mehrweg der letzten Position ein', async () => {
    // Punkte [start, E1, kand]; ohne separaten Endpunkt Rückweg zum Start (0).
    const matrix = [
      [0, 30, 30],
      [5, 0, 10],
      [20, 10, 0],
    ]
    const routing: RoutingProvider = { async travelMatrix() { return matrix } }
    // E1 muss bis 8:40 (520) beginnen → erzwingt E1 zuerst, Kandidat als letzten Stopp.
    const tour = basisTour({
      einsaetze: [
        { pseudonymId: '00000000-0000-4000-8000-000000000001', geo: g(1), zeitfenster: { von: 0, bis: 520 }, dauerMin: 30, qualifikation: [] },
      ],
    })
    const match = await fitScoreFuerTour(tour, kandidat(), routing)
    expect(match).not.toBeNull()
    expect(match!.position).toBe(1) // letzte Position
    // Basis 0→1→0 = 35. Mit Kandidat 0→1→2→0 = 60 → Mehrweg 25. Enthält den
    // geänderten Rückweg (2→0=20 statt 1→0=5), nicht nur den Hinweg (1→2=10).
    expect(match!.mehrwegMin).toBe(25)
  })

  it('nutzt einen separaten Endpunkt (ende ≠ start) für den Rückweg', async () => {
    // Punkte [start, E1, kand, ende]; Rückweg zum ENDE (Index 3).
    const matrix = [
      [0, 10, 10, 99],
      [10, 0, 10, 5],
      [10, 10, 0, 40],
      [99, 5, 40, 0],
    ]
    const routing: RoutingProvider = { async travelMatrix() { return matrix } }
    const tour = basisTour({
      ende: g(9),
      einsaetze: [
        { pseudonymId: '00000000-0000-4000-8000-000000000001', geo: g(1), zeitfenster: { von: 0, bis: 520 }, dauerMin: 30, qualifikation: [] },
      ],
    })
    const match = await fitScoreFuerTour(tour, kandidat(), routing)
    expect(match).not.toBeNull()
    expect(match!.position).toBe(1)
    // Basis 0→1→ende = 10+5 = 15. Mit Kandidat 0→1→2→ende = 10+10+40 = 60 →
    // Mehrweg 45. Nutzt den teuren Rückweg kand→ende (40); zum Start wäre es 10.
    expect(match!.mehrwegMin).toBe(45)
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

// Pflichtenheft 5.1.1: Geschlechtspräferenz als weiche Restriktion.
describe('Fit-Score (Geschlechtspräferenz, weiche Restriktion)', () => {
  it('reiht die Tour mit passendem Geschlecht der Pflegekraft nach vorne', async () => {
    const tourM = basisTour({ id: 'T1', pflegekraftId: 'pk-001', pflegekraftGeschlecht: 'm' })
    const tourW = basisTour({ id: 'T2', pflegekraftId: 'pk-002', pflegekraftGeschlecht: 'w' })
    const matches = await fitScore([tourM, tourW], kandidat({ geschlechtPraeferenz: 'w' }), stubRouting)
    expect(matches).toHaveLength(2)
    expect(matches[0].pflegekraftId).toBe('pk-002')
    expect(matches[0].praeferenzErfuellt).toBe(true)
    expect(matches[1].praeferenzErfuellt).toBe(false)
  })

  it('lässt Bezugspflege der Geschlechtspräferenz vorgehen', async () => {
    // Wunschkraft ist pk-001 (männlich); Geschlechtspräferenz zeigt auf pk-002.
    // Bezugspflege hat Vorrang → pk-001 zuerst.
    const tourM = basisTour({ id: 'T1', pflegekraftId: 'pk-001', pflegekraftGeschlecht: 'm' })
    const tourW = basisTour({ id: 'T2', pflegekraftId: 'pk-002', pflegekraftGeschlecht: 'w' })
    const matches = await fitScore(
      [tourM, tourW],
      kandidat({ bezugspflege: 'pk-001', geschlechtPraeferenz: 'w' }),
      stubRouting,
    )
    expect(matches[0].pflegekraftId).toBe('pk-001')
    expect(matches[0].bezugspflegeErfuellt).toBe(true)
  })
})
