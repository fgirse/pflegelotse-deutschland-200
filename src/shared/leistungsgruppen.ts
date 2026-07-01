// Klartext-Leistungskatalog für das Bedarfs-Aufnahmeformular (verständlich für
// Angehörige/Sozialdienste), gruppiert exakt wie im Aufnahmeformular (Screenshot).
// Optionales, pluggbares Mapping auf abrechnungsrelevante LK-Codes je Bundesland
// (nur wo ein verifizierter Landeskatalog vorliegt — sonst bleibt es leer;
// es werden keine LK-Zuordnungen geraten). Siehe docs/leistungskomplexe-quelle.md.
import type { Bundesland } from './leistungskomplexe'

export interface Leistungsposition {
  key: string
  label: string
  // Zuordnung zu LK-Codes je Bundesland (optional, verifiziert einpflegen).
  lk?: Partial<Record<Bundesland, string[]>>
}

export type LeistungsgruppeKey =
  | 'koerperpflege'
  | 'medizinisch'
  | 'begleitung'
  | 'hauswirtschaft'
  | 'beratung'

export interface Leistungsgruppe {
  key: LeistungsgruppeKey
  titel: string
  // Ankreuzbare Einzelleistungen (bei „begleitung" leer → nur Freitext).
  positionen: Leistungsposition[]
  // Nur-Freitext-Gruppe (Begleitung/Betreuung: „Welche Unterstützung …?").
  nurFreitext?: boolean
  // Hat die Gruppe die Häufigkeitsangaben (Tage/Woche + mal/Tag)?
  frequenz: boolean
}

export const LEISTUNGSGRUPPEN: Leistungsgruppe[] = [
  {
    key: 'koerperpflege',
    titel: 'Körperpflege',
    frequenz: true,
    positionen: [
      { key: 'waschen', label: 'Waschen', lk: { 'Baden-Württemberg': ['LK2'] } },
      { key: 'duschen_baden', label: 'Duschen / Baden', lk: { 'Baden-Württemberg': ['LK1'] } },
      { key: 'toilette', label: 'Toilettengänge / Vorlagenwechsel', lk: { 'Baden-Württemberg': ['LK4'] } },
      { key: 'umlagern', label: 'Umlagern / Positionswechsel im Bett', lk: { 'Baden-Württemberg': ['LK6'] } },
      { key: 'mobilisation', label: 'Mobilisation, Aufstehen und Umsetzen', lk: { 'Baden-Württemberg': ['LK7'] } },
      { key: 'nahrungsaufnahme', label: 'Hilfe bei der Nahrungsaufnahme', lk: { 'Baden-Württemberg': ['LK8', 'LK9'] } },
    ],
  },
  {
    key: 'medizinisch',
    titel: 'Medizinische Leistung (ärztliche Verordnung)',
    frequenz: true,
    // Behandlungspflege = SGB V (Häusliche Krankenpflege), NICHT in den
    // SGB-XI-Leistungskomplexen der Länderkataloge — daher kein LK-Mapping.
    positionen: [
      { key: 'medikamentengabe', label: 'Medikamentengabe' },
      { key: 'verbandswechsel', label: 'Verbandswechsel' },
      { key: 'kompressionsstruempfe', label: 'Kompressionsstrümpfe an- und ausziehen' },
      { key: 'blutzuckermessung', label: 'Blutzuckermessung' },
      { key: 'insulingabe', label: 'Insulingabe' },
      { key: 'absaugen', label: 'Absaugen / Sauerstoffgabe' },
      { key: 'stoma', label: 'Stomaversorgung' },
    ],
  },
  {
    key: 'begleitung',
    titel: 'Begleitung und Betreuung',
    frequenz: true,
    nurFreitext: true,
    positionen: [],
  },
  {
    key: 'hauswirtschaft',
    titel: 'Hauswirtschaft',
    frequenz: true,
    positionen: [
      { key: 'einkaufen', label: 'Einkaufen', lk: { 'Baden-Württemberg': ['LK15'] } },
      { key: 'kochen', label: 'Zubereitung von Speisen', lk: { 'Baden-Württemberg': ['LK12', 'LK14'] } },
      { key: 'reinigen', label: 'Aufräumen und Reinigen der Wohnung', lk: { 'Baden-Württemberg': ['LK16'] } },
      { key: 'waesche', label: 'Waschen und Pflegen der Kleidung', lk: { 'Baden-Württemberg': ['LK16'] } },
    ],
  },
  {
    key: 'beratung',
    titel: 'Beratungen',
    frequenz: false,
    positionen: [
      { key: 'beratung_37_3', label: 'Beratungseinsatz nach § 37.3 SGB XI für Pflegegeldempfänger*innen' },
      { key: 'pflegeschulung_45', label: 'Pflegeschulung in der Häuslichkeit nach § 45 SGB XI' },
    ],
  },
]

// Regelmäßige Abwesenheitszeiten der betreuten Person (Tour-Constraint).
export const ABWESENHEITEN = ['tagespflege', 'therapie', 'dialyse', 'arbeit', 'sonstiges'] as const
export type Abwesenheit = (typeof ABWESENHEITEN)[number]

// Wohnsituation (matching-/planungsrelevant).
export const WOHNSITUATIONEN = ['alleinlebend', 'gemeinschaft'] as const
export type Wohnsituation = (typeof WOHNSITUATIONEN)[number]

// Gewünschte Kontaktart (Schritt 3).
export const KONTAKTARTEN = ['telefon', 'email'] as const
export type Kontaktart = (typeof KONTAKTARTEN)[number]

// Übersetzt die ausgewählten Klartext-Positionen einer Gruppe in LK-Codes des
// Bundeslands (nur wo Mapping hinterlegt ist). Für die Abrechnungsanbindung.
export function lkCodesFuer(
  gruppe: LeistungsgruppeKey,
  positionKeys: string[],
  bundesland?: Bundesland,
): string[] {
  const g = LEISTUNGSGRUPPEN.find((x) => x.key === gruppe)
  if (!g || !bundesland) return []
  const codes = new Set<string>()
  for (const p of g.positionen) {
    if (positionKeys.includes(p.key)) {
      for (const c of p.lk?.[bundesland] ?? []) codes.add(c)
    }
  }
  return [...codes]
}
