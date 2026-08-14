import type { NachweisEintrag } from '@/server/nachweis/kette'
import { LEISTUNGSKOMPLEXE } from '@/shared/leistungskomplexe'

// Code → Bezeichnung aus dem Standard-Leistungskatalog (Fallback).
const BEZEICHNUNG = new Map(LEISTUNGSKOMPLEXE.map((l) => [l.code, l.bezeichnung]))

export interface KlientInfo {
  name: string
  kostentraegerArt?: string
  versicherung?: string
}

// Eine bepreiste Abrechnungsposition (je Leistungskomplex eines Besuchs).
export interface AbrechnungPosition {
  pseudonymId: string
  name: string
  datum: string
  leistungskomplex: string
  bezeichnung: string
  menge: number
  einzelpreisEuro: number
  betragEuro: number
  kostentraegerArt?: string
  versicherung?: string
}

// Eine Buchung (Summe eines Besuchs) — Basis der DATEV-Zeile.
export interface Buchung {
  pseudonymId: string
  name: string
  datum: string
  betragEuro: number
  leistungen: string[]
  kostentraegerArt?: string // für die Kontenwahl im DATEV-Stapel (GKV/PKV)
}

export interface Aggregat {
  positionen: AbrechnungPosition[]
  buchungen: Buchung[]
  summeEuro: number
}

const rund = (n: number) => Math.round(n * 100) / 100

// Aggregiert die Nachweis-Einträge zu bepreisten Positionen (je Leistung) und
// Buchungen (je Besuch). Preise fehlender Codes gelten als 0.
export function aggregiere(
  nachweise: NachweisEintrag[],
  preise: Record<string, number>,
  klienten: Map<string, KlientInfo>,
  preisePrivat: Record<string, number> = {},
): Aggregat {
  const positionen: AbrechnungPosition[] = []
  const buchungen: Buchung[] = []
  let summe = 0

  for (const n of nachweise) {
    const info = klienten.get(n.pseudonymId) ?? { name: 'Unbekannt' }
    const istPrivat = info.kostentraegerArt === 'privat'
    // Gleiche Leistungscodes eines Besuchs zu einer Menge zusammenfassen.
    const zaehler = new Map<string, number>()
    for (const code of n.erbrachteLeistungen) zaehler.set(code, (zaehler.get(code) ?? 0) + 1)

    let besuchBetrag = 0
    for (const [code, menge] of zaehler) {
      // Privatversicherte zum PKV-Satz abrechnen; fehlt er, gilt der GKV-Satz.
      const einzel = (istPrivat ? preisePrivat[code] : undefined) ?? preise[code] ?? 0
      const betrag = rund(einzel * menge)
      besuchBetrag += betrag
      positionen.push({
        pseudonymId: n.pseudonymId,
        name: info.name,
        datum: n.datum,
        leistungskomplex: code,
        bezeichnung: BEZEICHNUNG.get(code) ?? code,
        menge,
        einzelpreisEuro: einzel,
        betragEuro: betrag,
        kostentraegerArt: info.kostentraegerArt,
        versicherung: info.versicherung,
      })
    }
    besuchBetrag = rund(besuchBetrag)
    summe += besuchBetrag
    buchungen.push({
      pseudonymId: n.pseudonymId,
      name: info.name,
      datum: n.datum,
      betragEuro: besuchBetrag,
      leistungen: [...zaehler.keys()],
      kostentraegerArt: info.kostentraegerArt,
    })
  }

  return { positionen, buchungen, summeEuro: rund(summe) }
}
