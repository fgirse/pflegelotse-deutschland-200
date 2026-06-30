// Standardisierte Leistungskomplexe (LK) der ambulanten Pflege — eine Quelle
// der Wahrheit für Frontend (Auswahl im Bedarfsformular) und Server (KI-Lotse).
//
// WICHTIG (Abrechnung): Nummerierung, Zuschnitt und Punktwerte der LK stammen
// aus den Vergütungsvereinbarungen / Landesrahmenverträgen (§89 SGB XI) und
// unterscheiden sich je Bundesland. Der LEISTUNGSKOMPLEXE unten ist eine
// vereinfachte, repräsentative Auswahl und dient nur als FALLBACK, solange für
// ein Bundesland keine offizielle Tabelle in KATALOG_NACH_BUNDESLAND hinterlegt
// ist. Für den Produktivbetrieb sind die geprüften Landestabellen einzupflegen.
export interface Leistungskomplex {
  code: string
  bezeichnung: string
  qualifikation: 'grundpflege' | 'behandlungspflege'
  stichworte: string[]
}

// Die 16 Bundesländer (für die landesspezifische Katalog-Auswahl).
export const BUNDESLAENDER = [
  'Baden-Württemberg',
  'Bayern',
  'Berlin',
  'Brandenburg',
  'Bremen',
  'Hamburg',
  'Hessen',
  'Mecklenburg-Vorpommern',
  'Niedersachsen',
  'Nordrhein-Westfalen',
  'Rheinland-Pfalz',
  'Saarland',
  'Sachsen',
  'Sachsen-Anhalt',
  'Schleswig-Holstein',
  'Thüringen',
] as const
export type Bundesland = (typeof BUNDESLAENDER)[number]

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

// Offizielle, landesspezifische Kataloge. Schlüssel = Bundesland.
// PLATZHALTER: Noch keine geprüfte Landestabelle hinterlegt — daher leer; alle
// Bundesländer nutzen vorerst den Fallback LEISTUNGSKOMPLEXE. Sobald die offizielle
// Tabelle eines Landes vorliegt, hier eintragen, z. B.:
//   'Baden-Württemberg': [
//     { code: 'LK01', bezeichnung: '…', qualifikation: 'grundpflege', stichworte: ['…'] },
//     …
//   ],
export const KATALOG_NACH_BUNDESLAND: Partial<Record<Bundesland, Leistungskomplex[]>> = {}

// Liefert den Leistungskatalog für ein Bundesland: die offizielle Landestabelle,
// falls hinterlegt — sonst den vorläufigen Standard-Fallback.
export function leistungenFuerBundesland(bl?: Bundesland): Leistungskomplex[] {
  return (bl && KATALOG_NACH_BUNDESLAND[bl]) || LEISTUNGSKOMPLEXE
}

// Nutzt das Bundesland noch den vorläufigen Standard-Katalog (keine offizielle
// Landestabelle hinterlegt)? Für einen Hinweis in der UI.
export function istVorlaeufigerKatalog(bl?: Bundesland): boolean {
  return !(bl && KATALOG_NACH_BUNDESLAND[bl])
}

// Bekannter Code im jeweiligen Katalog? (für Validierung/Filterung von Eingaben)
export function istBekannterLkCode(code: string, bl?: Bundesland): boolean {
  return leistungenFuerBundesland(bl).some((l) => l.code === code)
}
