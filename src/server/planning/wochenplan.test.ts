import { describe, it, expect } from 'vitest'
import {
  isoWochentag,
  montagDerWoche,
  wocheDaten,
  generiereWoche,
  filtereNeue,
  tourSchluessel,
  type TourEntwurf,
} from './wochenplan'
import type { Stammtour, StammEinsatz } from '@/shared/domain'

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const g = (n: number) => ({ lat: 48 + n / 1000, lng: 7.8 + n / 1000 })
const fenster = { von: 480, bis: 720 }

function einsatz(n: number, wochentage?: number[]): StammEinsatz {
  return { pseudonymId: uid(n), geo: g(n), zeitfenster: fenster, dauerMin: 30, qualifikation: [], wochentage }
}

function stammtour(over: Partial<Stammtour> = {}): Stammtour {
  return {
    id: 'ST1',
    tenantId: 'demo',
    pflegekraftId: 'pk-001',
    pflegekraftQualifikation: ['grundpflege'],
    start: g(0),
    startZeit: 480,
    wochentage: [1, 3, 5], // Mo, Mi, Fr
    einsaetze: [einsatz(1), einsatz(2)],
    ...over,
  }
}

// 2024-01-01 war ein Montag (ISO-Woche) — fester Anker für die Datumslogik.
describe('Wochenplan — Datumslogik (UTC, ISO Mo=1)', () => {
  it('bestimmt den ISO-Wochentag korrekt', () => {
    expect(isoWochentag('2024-01-01')).toBe(1) // Montag
    expect(isoWochentag('2024-01-03')).toBe(3) // Mittwoch
    expect(isoWochentag('2024-01-07')).toBe(7) // Sonntag
  })

  it('normalisiert ein beliebiges Datum auf den Montag der Woche', () => {
    expect(montagDerWoche('2024-01-03')).toBe('2024-01-01') // Mi → Mo
    expect(montagDerWoche('2024-01-07')).toBe('2024-01-01') // So → Mo
    expect(montagDerWoche('2024-01-01')).toBe('2024-01-01') // Mo → Mo
  })

  it('liefert die sieben Tage einer Woche ab Montag', () => {
    expect(wocheDaten('2024-01-01')).toEqual([
      '2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-06', '2024-01-07',
    ])
  })
})

// Abnahmekriterium 2.2: Stammtour Mo/Mi/Fr → genau drei Tour-Instanzen.
describe('Wochenplan — Generierung', () => {
  it('erzeugt für eine Mo/Mi/Fr-Stammtour genau drei Touren mit korrekten Einsätzen', () => {
    const entwuerfe = generiereWoche([stammtour()], '2024-01-01')
    expect(entwuerfe).toHaveLength(3)
    expect(entwuerfe.map((e) => e.datum)).toEqual(['2024-01-01', '2024-01-03', '2024-01-05'])
    for (const e of entwuerfe) {
      expect(e.stammtourId).toBe('ST1')
      expect(e.pflegekraftId).toBe('pk-001')
      expect(e.einsaetze).toHaveLength(2)
    }
  })

  it('berücksichtigt die eigene Frequenz je Stammeinsatz', () => {
    // Einsatz 1 an Mo/Mi/Fr, Einsatz 2 nur montags.
    const st = stammtour({ einsaetze: [einsatz(1), einsatz(2, [1])] })
    const entwuerfe = generiereWoche([st], '2024-01-01')
    expect(entwuerfe).toHaveLength(3)
    const montag = entwuerfe.find((e) => e.datum === '2024-01-01')!
    const mittwoch = entwuerfe.find((e) => e.datum === '2024-01-03')!
    expect(montag.einsaetze).toHaveLength(2) // beide
    expect(mittwoch.einsaetze).toHaveLength(1) // nur Einsatz 1
    expect(mittwoch.einsaetze[0].pseudonymId).toBe(uid(1))
  })

  it('erzeugt keine leere Tour, wenn an einem Tag kein Einsatz fällig ist', () => {
    // Tour läuft Mo/Mi/Fr, aber der einzige Einsatz nur mittwochs.
    const st = stammtour({ einsaetze: [einsatz(1, [3])] })
    const entwuerfe = generiereWoche([st], '2024-01-01')
    expect(entwuerfe).toHaveLength(1)
    expect(entwuerfe[0].datum).toBe('2024-01-03')
  })

  it('respektiert den Gültigkeitszeitraum (aktivAb/aktivBis)', () => {
    const st = stammtour({ aktivAb: '2024-01-04' }) // erst ab Do → nur Fr (Jan 5)
    const entwuerfe = generiereWoche([st], '2024-01-01')
    expect(entwuerfe.map((e) => e.datum)).toEqual(['2024-01-05'])
  })
})

describe('Wochenplan — Idempotenz', () => {
  it('filtert Entwürfe heraus, für die schon eine generierte Tour existiert', () => {
    const entwuerfe = generiereWoche([stammtour()], '2024-01-01')
    // Montag ist bereits vorhanden → bleibt erhalten, wird nicht neu erzeugt.
    const vorhanden = new Set([tourSchluessel({ stammtourId: 'ST1', datum: '2024-01-01' })])
    const neue = filtereNeue(entwuerfe, vorhanden)
    expect(neue.map((e: TourEntwurf) => e.datum)).toEqual(['2024-01-03', '2024-01-05'])
  })
})
