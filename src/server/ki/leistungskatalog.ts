// Vereinfachter Katalog standardisierter Leistungskomplexe (LK) der ambulanten
// Pflege. Die konkrete Nummerierung variiert je Bundesland — hier eine
// repräsentative Auswahl zum Nachschlagen durch den KI-Lotsen (/F140/, /F620/).
// `qualifikation` ordnet grob Grund- vs. Behandlungspflege zu.
export interface Leistungskomplex {
  code: string
  bezeichnung: string
  qualifikation: 'grundpflege' | 'behandlungspflege'
  stichworte: string[]
}

export const LEISTUNGSKATALOG: Leistungskomplex[] = [
  { code: 'LK01', bezeichnung: 'Kleine Morgentoilette', qualifikation: 'grundpflege', stichworte: ['waschen', 'morgen', 'toilette', 'anziehen'] },
  { code: 'LK02', bezeichnung: 'Große Morgentoilette', qualifikation: 'grundpflege', stichworte: ['duschen', 'baden', 'morgen', 'körperpflege'] },
  { code: 'LK03', bezeichnung: 'Kleine Abendtoilette', qualifikation: 'grundpflege', stichworte: ['abend', 'waschen', 'ausziehen'] },
  { code: 'LK04', bezeichnung: 'Große Abendtoilette', qualifikation: 'grundpflege', stichworte: ['abend', 'duschen', 'baden'] },
  { code: 'LK05', bezeichnung: 'Lagern und Betten', qualifikation: 'grundpflege', stichworte: ['lagern', 'betten', 'dekubitus', 'umlagern'] },
  { code: 'LK06', bezeichnung: 'Hilfe bei der Nahrungsaufnahme', qualifikation: 'grundpflege', stichworte: ['essen', 'füttern', 'nahrung', 'trinken'] },
  { code: 'LK07', bezeichnung: 'Darm- und Blasenentleerung', qualifikation: 'grundpflege', stichworte: ['toilette', 'inkontinenz', 'katheter', 'windel'] },
  { code: 'LK12', bezeichnung: 'Hauswirtschaftliche Versorgung', qualifikation: 'grundpflege', stichworte: ['putzen', 'einkaufen', 'kochen', 'haushalt', 'wäsche'] },
  { code: 'LK15', bezeichnung: 'Medikamentengabe', qualifikation: 'behandlungspflege', stichworte: ['medikament', 'tabletten', 'arznei'] },
  { code: 'LK16', bezeichnung: 'Injektionen', qualifikation: 'behandlungspflege', stichworte: ['spritze', 'injektion', 'insulin'] },
  { code: 'LK17', bezeichnung: 'Verbandwechsel', qualifikation: 'behandlungspflege', stichworte: ['verband', 'wunde', 'wundversorgung'] },
  { code: 'LK18', bezeichnung: 'Blutzuckermessung', qualifikation: 'behandlungspflege', stichworte: ['blutzucker', 'diabetes', 'messung'] },
]

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
