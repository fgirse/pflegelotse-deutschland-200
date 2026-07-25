import { schreibeCsv, euro } from './csv'
import type { Buchung } from './aggregat'

// DATEV-Kopfdaten je Mandant.
export interface DatevKonfig {
  beraterNr?: string
  mandantenNr?: string
  wjBeginn?: string // YYYYMMDD
  sachkontenlaenge?: number
  erloesKonto?: string
  debitorKonto?: string
}

const q = (s: string) => `"${s.replace(/"/g, '""')}"`
const jjjjmmtt = (iso: string) => iso.replace(/-/g, '') // YYYY-MM-DD → YYYYMMDD
const ttmm = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}${m}` // Belegdatum DDMM
}

// Die 14 führenden Standardspalten des DATEV-EXTF-Buchungsstapels.
export const DATEV_SPALTEN = [
  'Umsatz (ohne Soll/Haben-Kz)',
  'Soll/Haben-Kennzeichen',
  'WKZ Umsatz',
  'Kurs',
  'Basis-Umsatz',
  'WKZ Basis-Umsatz',
  'Konto',
  'Gegenkonto (ohne BU-Schlüssel)',
  'BU-Schlüssel',
  'Belegdatum',
  'Belegfeld 1',
  'Belegfeld 2',
  'Skonto',
  'Buchungstext',
]

// Baut einen DATEV-EXTF-Buchungsstapel (Format 700 / Kategorie 21). Je Besuch
// eine Erlösbuchung: Debitor (Soll) an Erlöskonto. Der Zeitstempel wird
// injiziert (deterministisch/testbar). Hinweis: die exakte Feld-/Spaltenzahl
// vor Produktivimport gegen die Ziel-DATEV-Formatversion validieren.
export function baueDatevStapel(
  buchungen: Buchung[],
  konfig: DatevKonfig,
  von: string,
  bis: string,
  stamp: string,
): string {
  const kopf = [
    q('EXTF'), '700', '21', q('Buchungsstapel'), '13', stamp, '', '', '', '',
    konfig.beraterNr ?? '', konfig.mandantenNr ?? '', konfig.wjBeginn ?? '', String(konfig.sachkontenlaenge ?? 4),
    jjjjmmtt(von), jjjjmmtt(bis), q('Pflegeleistungen'), '', '1', '0', '0', q('EUR'),
  ].join(';')

  const spaltenZeile = DATEV_SPALTEN.map(q).join(';')

  const zeilen = buchungen.map((b, i) => [
    euro(b.betragEuro), // Umsatz
    'S', // Soll/Haben: Debitor im Soll
    'EUR',
    '', // Kurs
    '', // Basis-Umsatz
    '', // WKZ Basis-Umsatz
    konfig.debitorKonto ?? '', // Konto (Debitor)
    konfig.erloesKonto ?? '', // Gegenkonto (Erlöse)
    '', // BU-Schlüssel
    ttmm(b.datum), // Belegdatum DDMM
    `R${i + 1}`, // Belegfeld 1 (Referenz)
    '', // Belegfeld 2
    '', // Skonto
    `Pflege ${b.name} ${b.datum}`.slice(0, 60), // Buchungstext
  ])

  return `${kopf}\r\n${spaltenZeile}\r\n${schreibeCsv(zeilen)}`
}
