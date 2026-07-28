// Crosswalk FHIR-Leistungscode → interner Leistungskomplex-Code (§8.2).
// Beispielhaft; produktiv gegen den regionalen Leistungskatalog (HKP-Positionen
// nach §37 SGB V / Landesvertrag) zu pflegen. Unbekannte Codes laufen als
// Pass-through durch, damit nichts stillschweigend verloren geht.
const CODE_MAP: Record<string, string> = {
  // Beispiel: HKP-Positionsnummern → interne LK-Codes.
  '01': 'LK01',
  '02': 'LK02',
  '15': 'LK15',
}

export function mappeLeistungsCode(code: string): string {
  return CODE_MAP[code] ?? code
}
