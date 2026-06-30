// Standardisierte Leistungskomplexe (LK) der ambulanten Pflege — eine Quelle
// der Wahrheit für Frontend (Auswahl im Bedarfsformular) und Server (KI-Lotse).
// Die konkrete Nummerierung variiert je Bundesland; dies ist eine
// repräsentative, vereinfachte Auswahl (/F140/).
export interface Leistungskomplex {
  code: string
  bezeichnung: string
  qualifikation: 'grundpflege' | 'behandlungspflege'
  stichworte: string[]
}

export const LEISTUNGSKOMPLEXE: Leistungskomplex[] = [
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

// Bekannter Code? (für Validierung/Filterung von Eingaben)
export function istBekannterLkCode(code: string): boolean {
  return LEISTUNGSKOMPLEXE.some((l) => l.code === code)
}
