import { z } from 'zod'

// Chat-Nachricht (nur Text — niemals PII, /F640/).
export const kiNachrichtSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
})
export type KiNachricht = z.infer<typeof kiNachrichtSchema>

export const kiChatRequestSchema = z.object({
  nachrichten: z.array(kiNachrichtSchema).min(1).max(40),
})
export type KiChatRequest = z.infer<typeof kiChatRequestSchema>

// Strukturierter Bedarfsentwurf, den die KI vorschlägt (zum Vorbefüllen des
// Formulars). Enthält bewusst KEINE Kontaktdaten.
export const bedarfEntwurfSchema = z.object({
  ort: z.string().optional(),
  pflegegrad: z.number().int().min(1).max(5).optional(),
  leistungen: z.array(z.string()).default([]),
  qualifikation: z.array(z.string()).default([]),
  zeitVon: z.string().optional(), // "HH:MM"
  zeitBis: z.string().optional(),
  dauerMin: z.number().int().positive().optional(),
  express: z.boolean().optional(),
})
export type BedarfEntwurf = z.infer<typeof bedarfEntwurfSchema>

export const kiChatResponseSchema = z.object({
  antwort: z.string(),
  entwurf: bedarfEntwurfSchema.optional(),
})
export type KiChatResponse = z.infer<typeof kiChatResponseSchema>
