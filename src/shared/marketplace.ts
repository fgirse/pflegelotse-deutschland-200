import { z } from 'zod'
import { geoSchema, zeitfensterSchema, pseudonymIdSchema } from './domain'

// ── Marktplatz / Reverse Bidding (zod) ───────────────────────────────────
// Ein Bedarf ist marktplatzweit und pseudonym (Säule 2). Die Kontaktdaten der
// Angehörigen liegen getrennt in Säule 1 und werden erst bei der Auswahl eines
// Dienstes freigegeben (Anti-Leakage, /F340/ P6).

export const bedarfStatusSchema = z.enum([
  'offen', // eingestellt, wartet auf Angebote
  'in_bearbeitung', // mindestens ein Dienst hat ein Angebot abgegeben
  'vergeben', // Angehörige hat einen Dienst gewählt
  'abgesagt', // zurückgezogen oder 24h-Frist ohne Zusage
])
export type BedarfStatus = z.infer<typeof bedarfStatusSchema>

// Operative (pseudonyme) Bedarfsdaten — NIEMALS PII.
export const bedarfSchema = z.object({
  pseudonymId: pseudonymIdSchema,
  geo: geoSchema,
  pflegegrad: z.number().int().min(1).max(5).optional(),
  leistungen: z.array(z.string()).default([]),
  qualifikation: z.array(z.string()).default([]),
  zeitfenster: zeitfensterSchema,
  dauerMin: z.number().int().positive().default(30),
  express: z.boolean().default(false),
  status: bedarfStatusSchema.default('offen'),
  matchingTenants: z.array(z.string()).default([]),
  selectedTenantId: z.string().optional(),
  // ISO-Zeitstempel; deadlineAt = Frist der 24h-Rückmeldung.
  deadlineAt: z.string().optional(),
  firstResponseAt: z.string().optional(),
  createdAt: z.string().optional(), // von Payload gesetzt
})
export type Bedarf = z.infer<typeof bedarfSchema>

// Kontaktdaten der Angehörigen (PII → Säule 1, verschlüsselt).
export const kontaktSchema = z.object({
  vorname: z.string().min(1),
  nachname: z.string().min(1),
  telefon: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  adresse: z.string().optional(),
})
export type Kontakt = z.infer<typeof kontaktSchema>

// Eingabe beim Einstellen eines Bedarfs: operative Daten + Kontakt.
export const bedarfErstellenSchema = z.object({
  geo: geoSchema,
  pflegegrad: z.number().int().min(1).max(5).optional(),
  leistungen: z.array(z.string()).default([]),
  qualifikation: z.array(z.string()).default([]),
  zeitfenster: zeitfensterSchema,
  dauerMin: z.number().int().positive().default(30),
  express: z.boolean().default(false),
  kontakt: kontaktSchema,
})
export type BedarfErstellen = z.infer<typeof bedarfErstellenSchema>

export const angebotStatusSchema = z.enum(['abgegeben', 'zurueckgezogen'])

// Verbindliches Angebot eines Dienstes auf einen Bedarf.
export const angebotSchema = z.object({
  id: z.string(),
  bedarfPseudonymId: pseudonymIdSchema,
  tenantId: z.string().min(1),
  nachricht: z.string().default(''),
  // Marginaler Mehrweg aus dem Fit-Score (Transparenz/Sortierung), optional.
  mehrwegMin: z.number().optional(),
  status: angebotStatusSchema.default('abgegeben'),
  createdAt: z.string(),
})
export type Angebot = z.infer<typeof angebotSchema>
