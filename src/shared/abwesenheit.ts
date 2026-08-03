import { z } from 'zod'

// ── Abwesenheiten (Urlaub/Krankheit) ──────────────────────────────────────
// Zeiträume je Pflegekraft (Säule 2, pseudonym über pflegekraftId). Die
// Wochenplanung überspringt später Tage innerhalb eines Zeitraums.

const datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum als YYYY-MM-DD erwartet')

export const abwesenheitTypSchema = z.enum(['urlaub', 'krankheit', 'sonstiges'])
export type AbwesenheitTyp = z.infer<typeof abwesenheitTypSchema>

export const abwesenheitSchema = z
  .object({
    von: datum,
    bis: datum,
    typ: abwesenheitTypSchema,
    notiz: z.string().max(200).optional(),
  })
  // ISO-Datumsstrings sind lexikografisch vergleichbar.
  .refine((d) => d.bis >= d.von, { message: 'Ende liegt vor Beginn', path: ['bis'] })
export type AbwesenheitEingabe = z.infer<typeof abwesenheitSchema>

export interface AbwesenheitZeile {
  id: string
  von: string
  bis: string
  typ: AbwesenheitTyp
  notiz?: string
}
