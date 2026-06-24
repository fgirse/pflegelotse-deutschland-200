import { z } from 'zod'
import { pseudonymIdSchema } from './domain'

// Erhebung je Handlungsfeld: ausgewählte Risiken (IDs) + Ressourcen (Freitext).
export const feldErhebungSchema = z.object({
  feldId: z.string().min(1),
  risiken: z.array(z.string()).default([]),
  ressourcen: z.string().optional(),
})
export type FeldErhebung = z.infer<typeof feldErhebungSchema>

// Eine generierte (oder bearbeitete) Empfehlung.
export const empfehlungSchema = z.object({
  handlungsfeld: z.string(),
  titel: z.string(),
  beschreibung: z.string(),
  paragraf20: z.string(),
  begruendung: z.string(),
})
export type Empfehlung = z.infer<typeof empfehlungSchema>

export const praevStatusSchema = z.enum(['entwurf', 'finalisiert'])

// Persistierte Präventionsempfehlung (Säule 2, pseudonym — keine PII).
export const praeventionSchema = z.object({
  id: z.string(),
  pseudonymId: pseudonymIdSchema,
  tenantId: z.string().min(1),
  status: praevStatusSchema.default('entwurf'),
  felder: z.array(feldErhebungSchema).default([]),
  empfehlungen: z.array(empfehlungSchema).default([]),
  freitext: z.string().optional(),
  erstelltVon: z.string().optional(),
  createdAt: z.string().optional(),
})
export type Praevention = z.infer<typeof praeventionSchema>

// Eingabe beim Erstellen/Aktualisieren.
export const praevErstellenSchema = z.object({
  pseudonymId: pseudonymIdSchema,
  felder: z.array(feldErhebungSchema).default([]),
  empfehlungen: z.array(empfehlungSchema).optional(), // optional bearbeitet
  freitext: z.string().optional(),
})
export type PraevErstellen = z.infer<typeof praevErstellenSchema>
