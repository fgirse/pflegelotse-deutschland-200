// Zentrale Preis-/Tarifkonfiguration (in Cent, um Rundungsfehler zu vermeiden).
// Tarifkalibrierung ist laut Pflichtenheft ein offener Punkt (O4/O5).

// Angehörige: Express-Vermittlung, einmalig (/F1020/).
export const EXPRESS_CENTS = 1990 // 19,90 €

// Dienste: Vermittlungsgebühr je freigegebenem Kontakt (/F1040/, leck-sicher).
export const LEAD_FEE_CENTS = 4900 // 49,00 €

// Dienste: SaaS-Abo gestaffelt nach Dienstgröße (/F1030/) — Konfiguration;
// die eigentliche Mollie-Subscription (Mandat) ist ein Folgeschritt.
export const ABO_TIERS = {
  klein: { label: 'Klein (bis 5 Touren)', monatlichCents: 4900 },
  mittel: { label: 'Mittel (bis 15 Touren)', monatlichCents: 9900 },
  gross: { label: 'Groß (>15 Touren)', monatlichCents: 19900 },
} as const
export type AboStufe = keyof typeof ABO_TIERS

// Cent → Mollie-Betragsstring ("1990" → "19.90").
export function centsZuMollie(cents: number): string {
  return (cents / 100).toFixed(2)
}

// Cent → deutsche Anzeige ("1990" → "19,90 €").
export function centsZuEuro(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`
}
