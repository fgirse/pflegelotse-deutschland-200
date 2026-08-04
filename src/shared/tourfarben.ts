// Farbpalette für die Kartendarstellung: jede Tour bekommt eine eigene Farbe
// (Routenlinie + nummerierte Marker + Legende). Gemeinsame Quelle für die
// Disponenten-Karte und die Pflegekraft-Erfassung, damit die Farben passen.
export const TOUR_PALETTE = [
  '#b45309',
  '#1d4ed8',
  '#15803d',
  '#b91c1c',
  '#7c3aed',
  '#0891b2',
  '#c2410c',
  '#4d7c0f',
] as const

export function tourFarbe(index: number): string {
  return TOUR_PALETTE[index % TOUR_PALETTE.length]
}
