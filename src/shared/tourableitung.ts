// Ableitung der Tour-/Fit-Score-Eingaben aus dem neuen Bedarfsmodell.
//
// Das Aufnahmeformular erfasst Leistungen + Häufigkeit (Tage/Woche, mal/Tag)
// und Abwesenheits-Kategorien, aber KEINE exakte Uhrzeit je Einsatz. Für die
// Tourenplanung braucht der Fit-Score ein Zeitfenster (frühester–spätester
// Beginn) und eine Einsatzdauer. Beides wird hier HEURISTISCH aus den Angaben
// geschätzt — bewusst grob und als Schätzung gekennzeichnet. Präzises Slotting
// mehrerer Einsätze bräuchte eine explizite Uhrzeit-Angabe im Formular.
import type { LeistungsgruppenAuswahl } from './marketplace'
import type { Abwesenheit } from './leistungsgruppen'

// Grobe Minuten-Schätzung je Einzelleistung (Erfahrungswerte, keine Abrechnung).
const MINUTEN_JE_POSITION: Record<string, number> = {
  // Körperpflege
  waschen: 15,
  duschen_baden: 25,
  toilette: 10,
  umlagern: 10,
  mobilisation: 10,
  nahrungsaufnahme: 15,
  // Medizinisch
  medikamentengabe: 5,
  verbandswechsel: 15,
  kompressionsstruempfe: 10,
  blutzuckermessung: 5,
  insulingabe: 5,
  absaugen: 10,
  stoma: 15,
  // Hauswirtschaft
  einkaufen: 20,
  kochen: 30,
  reinigen: 30,
  waesche: 20,
}

const MIN_DAUER = 10
const MAX_DAUER = 120

// Geschätzte Dauer EINES Einsatzes: Summe der gewählten Einzelleistungen
// (über alle Gruppen), gedeckelt. Begleitung (Freitext) zählt pauschal.
export function geschaetzteEinsatzdauer(
  auswahl?: Record<string, LeistungsgruppenAuswahl>,
): number {
  if (!auswahl) return 30
  let summe = 0
  for (const [key, g] of Object.entries(auswahl)) {
    for (const p of g.positionen ?? []) summe += MINUTEN_JE_POSITION[p] ?? 10
    if (key === 'begleitung' && (g.beschreibung ?? '').trim()) summe += 30
    if ((g.andere ?? '').trim()) summe += 10
  }
  if (summe === 0) return 30
  return Math.min(MAX_DAUER, Math.max(MIN_DAUER, summe))
}

// Abgeleitetes Zeitfenster (frühester–spätester Beginn, Minuten seit Mitternacht)
// aus der dominierenden Leistungsgruppe + groben Abwesenheits-Kategorien.
export function abgeleitetesZeitfenster(
  auswahl?: Record<string, LeistungsgruppenAuswahl>,
  abwesenheiten: Abwesenheit[] = [],
): { von: number; bis: number } {
  const hat = (k: string) => {
    const g = auswahl?.[k]
    return !!g && ((g.positionen?.length ?? 0) > 0 || !!(g.beschreibung ?? '').trim())
  }
  // Grundfenster nach dominierender Gruppe.
  let von = 480 // 08:00
  let bis = 1080 // 18:00 (spätester Beginn)
  if (hat('koerperpflege')) {
    von = 420 // 07:00 — Körperpflege typischerweise morgens
    bis = 660 // 11:00
  } else if (hat('hauswirtschaft') && !hat('medizinisch')) {
    von = 540 // 09:00 — Hauswirtschaft tagsüber flexibel
    bis = 1020 // 17:00
  }
  // Abwesenheiten grob berücksichtigen: bei Tagespflege/Arbeit früher Einsatz
  // (vor Beginn der Abwesenheit), bei Dialyse/Therapie Fenster etwas weiten.
  if (abwesenheiten.includes('tagespflege') || abwesenheiten.includes('arbeit')) {
    von = Math.min(von, 420)
    bis = Math.min(bis, 540) // spätester Beginn 09:00
  }
  if (bis < von) bis = von
  return { von, bis }
}
