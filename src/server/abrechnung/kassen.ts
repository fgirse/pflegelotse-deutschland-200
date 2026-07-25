import { schreibeCsv, euro } from './csv'
import type { AbrechnungPosition } from './aggregat'

// Spalten des abrechnungsvorbereitenden Kassen-CSV (NICHT das zertifizierte
// §302-Format — dient als Input für Steuerberater/Abrechnungsdienstleister).
export const KASSEN_SPALTEN = [
  'Datum',
  'Klient',
  'Kostenträger',
  'Versicherung',
  'Leistungskomplex',
  'Bezeichnung',
  'Menge',
  'Einzelpreis (EUR)',
  'Betrag (EUR)',
]

export function baueKassenCsv(positionen: AbrechnungPosition[]): string {
  const zeilen = [
    KASSEN_SPALTEN,
    ...positionen.map((p) => [
      p.datum,
      p.name,
      p.kostentraegerArt ?? '',
      p.versicherung ?? '',
      p.leistungskomplex,
      p.bezeichnung,
      String(p.menge),
      euro(p.einzelpreisEuro),
      euro(p.betragEuro),
    ]),
  ]
  return schreibeCsv(zeilen)
}
