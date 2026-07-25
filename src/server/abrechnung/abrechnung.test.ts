import { describe, it, expect } from 'vitest'
import { schreibeCsv, euro } from './csv'
import { aggregiere, type KlientInfo } from './aggregat'
import { baueDatevStapel } from './datev'
import { baueKassenCsv } from './kassen'
import type { NachweisEintrag } from '@/server/nachweis/kette'

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function eintrag(over: Partial<NachweisEintrag> = {}): NachweisEintrag {
  return {
    pseudonymId: uid(1),
    datum: '2026-06-25',
    tourId: 'T1',
    erbrachteLeistungen: ['LK01'],
    bestaetigtAm: '2026-06-25T08:20:00.000Z',
    bestaetigtVon: 'pk-001',
    prevHash: '',
    hash: 'h1',
    ...over,
  }
}

const klienten = new Map<string, KlientInfo>([
  [uid(1), { name: 'Anna Bauer', kostentraegerArt: 'gesetzlich', versicherung: 'AOK' }],
])
const preise = { LK01: 25.5, LK02: 10 }

describe('CSV-Schreiber', () => {
  it('quotet Felder mit Trennzeichen/Anführungszeichen und verdoppelt Quotes', () => {
    expect(schreibeCsv([['a', 'b;c', 'd"e']])).toBe('a;"b;c";"d""e"')
  })
  it('formatiert Euro-Beträge mit Komma-Dezimal', () => {
    expect(euro(25.5)).toBe('25,50')
    expect(euro(1234.5)).toBe('1234,50')
  })
})

describe('Aggregation', () => {
  it('bepreist Leistungen und summiert je Besuch', () => {
    // Ein Besuch mit LK01 (2×) + LK02 (1×): 2·25,50 + 10 = 61.
    const agg = aggregiere([eintrag({ erbrachteLeistungen: ['LK01', 'LK01', 'LK02'] })], preise, klienten)
    expect(agg.positionen).toHaveLength(2)
    const lk01 = agg.positionen.find((p) => p.leistungskomplex === 'LK01')!
    expect(lk01).toMatchObject({ menge: 2, einzelpreisEuro: 25.5, betragEuro: 51, name: 'Anna Bauer' })
    expect(agg.buchungen).toHaveLength(1)
    expect(agg.buchungen[0].betragEuro).toBe(61)
    expect(agg.summeEuro).toBe(61)
  })

  it('behandelt fehlende Preise als 0', () => {
    const agg = aggregiere([eintrag({ erbrachteLeistungen: ['LK99'] })], preise, klienten)
    expect(agg.positionen[0].betragEuro).toBe(0)
  })
})

describe('DATEV-Export', () => {
  it('erzeugt Kopfzeile, Spaltenzeile und Buchungszeilen im EXTF-Format', () => {
    const agg = aggregiere([eintrag()], preise, klienten)
    const csv = baueDatevStapel(
      agg.buchungen,
      { beraterNr: '12345', mandantenNr: '1', wjBeginn: '20260101', erloesKonto: '8400', debitorKonto: '10000' },
      '2026-06-01',
      '2026-06-30',
      '20260701120000000',
    )
    const zeilen = csv.split('\r\n')
    expect(zeilen[0]).toContain('"EXTF";700;21;"Buchungsstapel";13;20260701120000000')
    expect(zeilen[0]).toContain('12345;1;20260101;4;20260601;20260630')
    expect(zeilen[1]).toContain('"Umsatz (ohne Soll/Haben-Kz)";"Soll/Haben-Kennzeichen"')
    // Buchungszeile: Umsatz 25,50 · S · EUR · … · Konto 10000 · Gegenkonto 8400 · Belegdatum 2506.
    expect(zeilen[2]).toBe('25,50;S;EUR;;;;10000;8400;;2506;R1;;;Pflege Anna Bauer 2026-06-25')
  })
})

describe('Kassen-Export', () => {
  it('erzeugt bepreiste Positionszeilen mit Kopfzeile', () => {
    const agg = aggregiere([eintrag()], preise, klienten)
    const csv = baueKassenCsv(agg.positionen)
    const zeilen = csv.split('\r\n')
    expect(zeilen[0]).toBe('Datum;Klient;Kostenträger;Versicherung;Leistungskomplex;Bezeichnung;Menge;Einzelpreis (EUR);Betrag (EUR)')
    expect(zeilen[1]).toContain('2026-06-25;Anna Bauer;gesetzlich;AOK;LK01;')
    expect(zeilen[1]).toContain(';1;25,50;25,50')
  })
})
