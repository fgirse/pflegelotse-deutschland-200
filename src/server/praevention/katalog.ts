// Katalog der Handlungsfelder für die ressourcenorientierte Bedarfserhebung
// im §37-Abs.-3-Beratungsbesuch (BEEP, §5 Abs. 1a SGB XI). Jedes Feld kennt
// typische Risiken und das passende Präventionsangebot nach §20 SGB V.
// KEINE fachliche Bewertung — nur Zuordnungslogik; die Entscheidung trifft die
// Pflegekraft (/F940/).

export interface RisikoItem {
  id: string
  label: string
}

export interface Handlungsfeld {
  id: string
  titel: string
  // §20-SGB-V-Bezug (Handlungsfeld der GKV-Primärprävention).
  paragraf20: string
  risiken: RisikoItem[]
  // Empfohlenes Angebot, wenn in diesem Feld ein Risiko vorliegt.
  angebot: { titel: string; beschreibung: string }
}

export const HANDLUNGSFELDER: Handlungsfeld[] = [
  {
    id: 'bewegung',
    titel: 'Bewegung & Sturzprophylaxe',
    paragraf20: 'Bewegungsgewohnheiten',
    risiken: [
      { id: 'sturz', label: 'Sturz in den letzten 12 Monaten' },
      { id: 'gangunsicher', label: 'Unsicheres Gangbild / Gleichgewicht' },
      { id: 'bewegungsmangel', label: 'Wenig körperliche Aktivität' },
    ],
    angebot: {
      titel: 'Sturzprophylaxe- und Bewegungskurs',
      beschreibung:
        'Wohnortnaher Bewegungskurs zur Kräftigung und Gleichgewichtsschulung (§20 SGB V).',
    },
  },
  {
    id: 'ernaehrung',
    titel: 'Ernährung',
    paragraf20: 'Ernährung',
    risiken: [
      { id: 'gewichtsverlust', label: 'Ungewollter Gewichtsverlust' },
      { id: 'mangelernaehrung', label: 'Anzeichen für Mangelernährung' },
      { id: 'trinkmenge', label: 'Zu geringe Trinkmenge' },
    ],
    angebot: {
      titel: 'Ernährungsberatung',
      beschreibung: 'Individuelle Ernährungsberatung zur Vermeidung von Mangelernährung (§20 SGB V).',
    },
  },
  {
    id: 'psyche',
    titel: 'Psychische Gesundheit & Stress',
    paragraf20: 'Stressmanagement',
    risiken: [
      { id: 'niedergeschlagen', label: 'Häufige Niedergeschlagenheit' },
      { id: 'ueberlastung', label: 'Überlastung (auch pflegende Angehörige)' },
    ],
    angebot: {
      titel: 'Stressbewältigung & Entspannung',
      beschreibung: 'Kurs zu Stressbewältigung/Entspannung, auch für pflegende Angehörige (§20 SGB V).',
    },
  },
  {
    id: 'teilhabe',
    titel: 'Soziale Teilhabe',
    paragraf20: 'Soziale Teilhabe',
    risiken: [
      { id: 'isolation', label: 'Soziale Isolation / wenig Kontakte' },
      { id: 'einsamkeit', label: 'Einsamkeitsgefühl' },
    ],
    angebot: {
      titel: 'Angebote zur sozialen Teilhabe',
      beschreibung: 'Vermittlung an Begegnungs-/Gruppenangebote im Quartier.',
    },
  },
  {
    id: 'kognition',
    titel: 'Kognitive Aktivierung',
    paragraf20: 'Kognitive Ressourcen',
    risiken: [
      { id: 'vergesslich', label: 'Zunehmende Vergesslichkeit' },
      { id: 'orientierung', label: 'Orientierungsschwierigkeiten' },
    ],
    angebot: {
      titel: 'Kognitives Aktivierungsangebot',
      beschreibung: 'Gedächtnis-/Aktivierungsangebot; bei Bedarf ärztliche Abklärung empfehlen.',
    },
  },
  {
    id: 'suchtmittel',
    titel: 'Suchtmittelkonsum',
    paragraf20: 'Suchtmittelkonsum',
    risiken: [
      { id: 'alkohol', label: 'Auffälliger Alkoholkonsum' },
      { id: 'tabak', label: 'Tabakkonsum' },
    ],
    angebot: {
      titel: 'Suchtberatung / Tabakentwöhnung',
      beschreibung: 'Vermittlung an Sucht-/Tabakentwöhnungsangebote (§20 SGB V).',
    },
  },
]

export function handlungsfeld(id: string): Handlungsfeld | undefined {
  return HANDLUNGSFELDER.find((h) => h.id === id)
}
