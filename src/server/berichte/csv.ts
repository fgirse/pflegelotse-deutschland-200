import { schreibeCsv } from '@/server/abrechnung/csv'
import type { MitarbeiterZeile, KilometerZeile } from './aggregat'

// Minuten → Stunden mit einer Nachkommastelle (deutsches Komma).
export function stunden(min: number): string {
  return (min / 60).toFixed(1).replace('.', ',')
}
const km = (n: number) => n.toFixed(1).replace('.', ',')

export const MITARBEITER_SPALTEN = [
  'Pflegekraft',
  'Touren',
  'Einsätze',
  'Arbeitszeit (h)',
  'Fahrzeit (h)',
  'Zeit am Klienten (h)',
  'Auslastung %',
  'Kilometer',
]

export function baueMitarbeiterCsv(zeilen: MitarbeiterZeile[]): string {
  return schreibeCsv([
    MITARBEITER_SPALTEN,
    ...zeilen.map((z) => [
      z.pflegekraftId,
      String(z.touren),
      String(z.einsaetze),
      stunden(z.arbeitszeitMin),
      stunden(z.fahrzeitMin),
      stunden(z.amKlientenMin),
      String(z.auslastungProzent),
      km(z.km),
    ]),
  ])
}

export const KILOMETER_SPALTEN = ['Datum', 'Pflegekraft', 'Kilometer', 'Fahrzeit (h)']

export function baueKilometerCsv(zeilen: KilometerZeile[]): string {
  return schreibeCsv([
    KILOMETER_SPALTEN,
    ...zeilen.map((z) => [z.datum, z.pflegekraftId, km(z.km), stunden(z.fahrzeitMin)]),
  ])
}
