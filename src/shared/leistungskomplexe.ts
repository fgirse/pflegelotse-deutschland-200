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
  // Optional: nur im Standard-Fallback gesetzt (KI-Suche). Die amtlichen
  // Landeskataloge sind flache, nummerierte Listen ohne diese Kategorisierung.
  qualifikation?: 'grundpflege' | 'behandlungspflege'
  stichworte?: string[]
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
export const KATALOG_NACH_BUNDESLAND: Partial<Record<Bundesland, Leistungskomplex[]>> = {
  // Baden-Württemberg — verifiziert aus der BMG-Übersicht (Stand 01.07.2021).
  // Nur die auswählbaren Leistungspakete; Wegepauschalen/Zuschläge ausgelassen.
  // Quelle/Hinweise: docs/leistungskomplexe-quelle.md
  'Baden-Württemberg': [
    { code: 'LK1', bezeichnung: 'Große Körperpflege' },
    { code: 'LK2', bezeichnung: 'Kleine Körperpflege' },
    { code: 'LK3', bezeichnung: 'Transfer/An-/Auskleiden' },
    { code: 'LK4', bezeichnung: 'Hilfe bei Ausscheidungen' },
    { code: 'LK6', bezeichnung: 'Lagern' },
    { code: 'LK7', bezeichnung: 'Mobilisation' },
    { code: 'LK8', bezeichnung: 'Einfache Hilfe bei der Nahrungsaufnahme' },
    { code: 'LK9', bezeichnung: 'Umfangreiche Hilfe bei der Nahrungsaufnahme' },
    { code: 'LK10', bezeichnung: 'Verabreichung von Sondennahrung mittels Spritze, Schwerkraft oder Pumpe' },
    { code: 'LK11', bezeichnung: 'Hilfestellung beim Verlassen und Wiederaufsuchen der Wohnung (ohne außerhäusliche Begleitung)' },
    { code: 'LK12', bezeichnung: 'Zubereitung einer einfachen Mahlzeit' },
    { code: 'LK13', bezeichnung: 'Essen auf Rädern / stationärer Mittagstisch' },
    { code: 'LK14', bezeichnung: 'Zubereitung einer (i. d. R. warmen) Mahlzeit in der Häuslichkeit' },
    { code: 'LK15', bezeichnung: 'Einkauf/Besorgungen (1/4 Std.)' },
    { code: 'LK16', bezeichnung: 'Waschen, Bügeln, Reinigen (1/4 Std.)' },
    { code: 'LK17', bezeichnung: 'Vollständiges Ab- und Beziehen eines Bettes' },
    { code: 'LK18', bezeichnung: 'Beheizen' },
    { code: 'LK21', bezeichnung: 'Pflegerische Betreuungsmaßnahmen (1/4 Std.)' },
    { code: 'LK22', bezeichnung: 'Organisation des Alltags und der Haushaltsführung (1/4 Std.)' },
  ],
}

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
