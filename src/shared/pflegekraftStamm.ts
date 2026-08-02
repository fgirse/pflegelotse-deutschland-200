import { z } from 'zod'

// ── Mitarbeiter-Stammdaten (Pflegekraft) ──────────────────────────────────
// Zentrales operatives Profil einer Pflegekraft (Säule 2, pseudonym über
// pflegekraftId). Ersetzt die heutige Neueingabe von Qualifikation/Geschlecht/
// Arbeitszeit je Tour: die Tour-/Stammtour-Anlage kann diese Werte erben.

// Für das Matching relevante Qualifikationen (Kraft muss die vom Klienten
// geforderten Qualifikationen abdecken).
export const PFLEGE_QUALIFIKATIONEN = ['grundpflege', 'behandlungspflege'] as const
export type PflegeQualifikation = (typeof PFLEGE_QUALIFIKATIONEN)[number]

export const pflegekraftStammSchema = z.object({
  qualifikation: z.array(z.enum(PFLEGE_QUALIFIKATIONEN)).default([]),
  geschlecht: z.enum(['m', 'w', 'd']).optional(),
  // Standard-Arbeitszeit als Minuten seit Mitternacht (z. B. 480 = 08:00).
  standardStartzeit: z.number().int().min(0).max(1439).optional(),
  standardEndzeit: z.number().int().min(0).max(1439).optional(),
  maxEinsaetze: z.number().int().min(0).max(50).optional(),
  // Regelarbeitstage als ISO-Wochentage (1 = Montag … 7 = Sonntag).
  wochentage: z.array(z.number().int().min(1).max(7)).default([]),
})
export type PflegekraftStammDaten = z.infer<typeof pflegekraftStammSchema>
