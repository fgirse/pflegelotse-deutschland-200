import type { Tour, Einsatz, FitScoreRequest } from '@/shared/domain'
import type { RoutingProvider } from '@/server/routing/RoutingProvider'
import { fitScore, qualifikationErfuellt } from '@/server/matching/fitScore'

// ── Kurzfristige Umplanung / Multi-Vehicle-Umverteilung (Pflichtenheft 5.2.2) ─
// Fällt eine Pflegekraft aus, werden ihre Einsätze auf die anderen verfügbaren
// Touren des Tages neu verteilt: greedy Cheapest-Insertion über den bestehenden
// Fit-Score. Machbarkeitserhaltend — was nirgends passt, wird als nicht
// platzierbar (mit Grund) gemeldet. Invariante: jeder verwaiste Einsatz taucht
// GENAU einmal auf (zugeordnet ODER nicht platzierbar) — keine stillen Verluste.

export type UmGrund = 'keineTouren' | 'qualifikation' | 'zeitfenster'

export interface Zuordnung {
  pseudonymId: string
  zielTourId: string
  position: number
  mehrwegMin: number
  ankunft: number
}
export interface NichtPlatzierbar {
  pseudonymId: string
  grund: UmGrund
}
export interface UmverteilungsErgebnis {
  zuordnungen: Zuordnung[]
  nichtPlatzierbar: NichtPlatzierbar[]
  zielTouren: Tour[] // Arbeitskopien mit eingefügten Einsätzen (für Persistenz/Anzeige)
}

function kandidatAus(e: Einsatz): FitScoreRequest['kandidat'] {
  return {
    pseudonymId: e.pseudonymId,
    geo: e.geo,
    zeitfenster: e.zeitfenster,
    dauerMin: e.dauerMin,
    grundzeitMin: e.grundzeitMin,
    qualifikation: e.qualifikation,
  }
}

// Schwierigste zuerst: engstes Zeitfenster, bei Gleichstand längste Dauer.
// Reduziert die Zahl der Nicht-Platzierbaren (harte Fälle bekommen zuerst Platz).
function nachSchwierigkeit(a: Einsatz, b: Einsatz): number {
  const breiteA = a.zeitfenster.bis - a.zeitfenster.von
  const breiteB = b.zeitfenster.bis - b.zeitfenster.von
  if (breiteA !== breiteB) return breiteA - breiteB
  return b.dauerMin - a.dauerMin
}

function grundFuer(touren: Tour[], kandidat: FitScoreRequest['kandidat']): UmGrund {
  if (touren.length === 0) return 'keineTouren'
  if (!touren.some((t) => qualifikationErfuellt(t, kandidat))) return 'qualifikation'
  return 'zeitfenster' // qualifiziert, aber kein machbarer Slot (Zeit/Kapazität/ArbZG)
}

export async function umverteile(
  verwaiste: Einsatz[],
  zielTouren: Tour[],
  routing: RoutingProvider,
): Promise<UmverteilungsErgebnis> {
  // Nur verfügbare Zieltouren; Arbeitskopien, damit Einfügungen fortlaufend wirken.
  const arbeit: Tour[] = zielTouren
    .filter((t) => t.verfuegbar !== false)
    .map((t) => ({ ...t, einsaetze: [...t.einsaetze] }))

  const zuordnungen: Zuordnung[] = []
  const nichtPlatzierbar: NichtPlatzierbar[] = []

  for (const e of [...verwaiste].sort(nachSchwierigkeit)) {
    const kandidat = kandidatAus(e)
    const matches = await fitScore(arbeit, kandidat, routing)
    const beste = matches[0]
    if (!beste) {
      nichtPlatzierbar.push({ pseudonymId: e.pseudonymId, grund: grundFuer(arbeit, kandidat) })
      continue
    }
    // Einsatz an der besten Position einfügen → nächster Einsatz sieht die neue Belegung.
    const ziel = arbeit.find((t) => t.id === beste.tourId)!
    ziel.einsaetze.splice(beste.position, 0, { ...e })
    zuordnungen.push({
      pseudonymId: e.pseudonymId,
      zielTourId: beste.tourId,
      position: beste.position,
      mehrwegMin: beste.mehrwegMin,
      ankunft: beste.ankunft,
    })
  }

  return { zuordnungen, nichtPlatzierbar, zielTouren: arbeit }
}
