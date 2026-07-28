import { describe, it, expect } from 'vitest'
import { tourKilometer, summeKm } from './kilometer'
import { aggregiereBerichte, type TourKennzahl } from './aggregat'
import { baueMitarbeiterCsv, stunden } from './csv'
import type { Tour } from '@/shared/domain'

const g = (lat: number, lng: number) => ({ lat, lng })

function tour(over: Partial<Tour> = {}): Tour {
  return {
    id: 'T1',
    tenantId: 'demo',
    datum: '2026-07-27',
    pflegekraftId: 'pk-001',
    pflegekraftQualifikation: [],
    start: g(48.0, 7.85),
    startZeit: 480,
    einsaetze: [],
    ...over,
  }
}

describe('Kilometer-Schätzung', () => {
  it('summiert Luftlinie × Umwegfaktor inkl. Rückweg zum Depot', () => {
    // Depot → Stopp (0.01° ≈ 1,11 km) und zurück; × 1,3 ≈ 2,9 km.
    const km = tourKilometer(tour({ einsaetze: [{ pseudonymId: 'p', geo: g(48.01, 7.85), zeitfenster: { von: 0, bis: 1439 }, dauerMin: 30, qualifikation: [] }] }))
    expect(km).toBeGreaterThan(2.5)
    expect(km).toBeLessThan(3.3)
  })
  it('liefert 0 km für eine Tour ohne Einsätze', () => {
    expect(tourKilometer(tour())).toBe(0)
  })

  it('summiert echte Distanzen aus der Provider-Matrix inkl. Rückweg zum Depot', () => {
    // Punkte [start, E1, E2]; 2 Einsätze; Rückweg zum Start (Index 0).
    const distanz = [
      [0, 3, 5],
      [3, 0, 2],
      [5, 2, 0],
    ]
    // start→E1 (3) + E1→E2 (2) + E2→start (5) = 10 km.
    expect(summeKm(distanz, 2, 0)).toBe(10)
  })
})

describe('Berichts-Aggregation', () => {
  const kennz: TourKennzahl[] = [
    { pflegekraftId: 'pk-001', datum: '2026-07-27', fahrzeitMin: 40, arbeitszeitMin: 130, amKlientenMin: 90, einsaetze: 3, km: 10 },
    { pflegekraftId: 'pk-001', datum: '2026-07-28', fahrzeitMin: 20, arbeitszeitMin: 80, amKlientenMin: 60, einsaetze: 2, km: 6 },
    { pflegekraftId: 'pk-002', datum: '2026-07-27', fahrzeitMin: 60, arbeitszeitMin: 60, amKlientenMin: 0, einsaetze: 0, km: 15 },
  ]

  it('gruppiert je Pflegekraft und rechnet Auslastung + km-Summe', () => {
    const b = aggregiereBerichte(kennz)
    const p1 = b.mitarbeiter.find((m) => m.pflegekraftId === 'pk-001')!
    expect(p1).toMatchObject({ touren: 2, einsaetze: 5, arbeitszeitMin: 210, fahrzeitMin: 60, amKlientenMin: 150, km: 16 })
    // Auslastung = 150 / (150 + 60) = 71 %.
    expect(p1.auslastungProzent).toBe(71)
    // pk-002 ohne Klientenzeit → 0 %.
    expect(b.mitarbeiter.find((m) => m.pflegekraftId === 'pk-002')!.auslastungProzent).toBe(0)
  })

  it('liefert je Tour eine Kilometer-Zeile, chronologisch sortiert', () => {
    const b = aggregiereBerichte(kennz)
    expect(b.kilometer).toHaveLength(3)
    expect(b.kilometer[0].datum).toBe('2026-07-27')
  })
})

describe('CSV-Bericht', () => {
  it('formatiert Stunden und schreibt die Kopfzeile', () => {
    expect(stunden(90)).toBe('1,5')
    const csv = baueMitarbeiterCsv(aggregiereBerichte([
      { pflegekraftId: 'pk-001', datum: '2026-07-27', fahrzeitMin: 60, arbeitszeitMin: 120, amKlientenMin: 60, einsaetze: 2, km: 10 },
    ]).mitarbeiter)
    const zeilen = csv.split('\r\n')
    expect(zeilen[0]).toBe('Pflegekraft;Touren;Einsätze;Arbeitszeit (h);Fahrzeit (h);Zeit am Klienten (h);Auslastung %;Kilometer')
    expect(zeilen[1]).toBe('pk-001;1;2;2,0;1,0;1,0;50;10,0')
  })
})
