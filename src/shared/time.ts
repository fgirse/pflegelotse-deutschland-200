// Minuten seit Mitternacht → "HH:MM".
export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// "HH:MM" → Minuten seit Mitternacht.
export function hhmmToMin(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
