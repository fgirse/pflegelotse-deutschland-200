// LK-Katalog für den KI-Lotsen. Die Daten leben jetzt in src/shared (eine
// Quelle der Wahrheit für FE + Server); hier bleibt die Stichwort-Suche (/F620/).
import { LEISTUNGSKOMPLEXE, type Leistungskomplex } from '@/shared/leistungskomplexe'

export type { Leistungskomplex }
export const LEISTUNGSKATALOG = LEISTUNGSKOMPLEXE

// Sucht Leistungskomplexe per Stichwort (Bezeichnung oder Schlagworte).
export function sucheLeistungen(stichwort: string): Leistungskomplex[] {
  const s = stichwort.toLowerCase().trim()
  if (!s) return []
  return LEISTUNGSKATALOG.filter(
    (lk) =>
      lk.bezeichnung.toLowerCase().includes(s) ||
      lk.code.toLowerCase() === s ||
      lk.stichworte.some((w) => w.includes(s) || s.includes(w)),
  )
}
