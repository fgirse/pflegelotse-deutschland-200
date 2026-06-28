import { z } from 'zod'
import { UUID_V4_PATTERN } from '@/lib/pseudonym'
import { KOSTENTRAEGER_ARTEN } from './krankenkassen'

// ── Gemeinsame Domänen-Schemas (zod) ─────────────────────────────────────
// Eine einzige Quelle der Wahrheit für Frontend, API und Matching.
// Zeiten werden als Minuten seit Mitternacht geführt (0–1439), das
// vereinfacht die Reisezeit-Arithmetik im Fit-Score.

export const pseudonymIdSchema = z
  .string()
  .regex(UUID_V4_PATTERN, 'Muss eine gültige UUIDv4 sein')

export const geoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})
export type Geo = z.infer<typeof geoSchema>

// Zeitfenster, in dem ein Einsatz beginnen darf.
export const zeitfensterSchema = z
  .object({
    von: z.number().int().min(0).max(1439), // frühester Beginn
    bis: z.number().int().min(0).max(1439), // spätester Beginn
  })
  .refine((z) => z.von <= z.bis, 'von muss <= bis sein')
export type Zeitfenster = z.infer<typeof zeitfensterSchema>

export const statusSchema = z.enum(['aktiv', 'pausiert', 'beendet'])

// Säule-2-Klient (operativ, pseudonymisiert — niemals PII).
export const klientOperativSchema = z.object({
  pseudonymId: pseudonymIdSchema,
  tenantId: z.string().min(1),
  geo: geoSchema,
  pflegegrad: z.number().int().min(1).max(5).optional(),
  leistungen: z.array(z.string()).default([]), // Leistungskomplex-Codes, z. B. "LK01"
  qualifikation: z.array(z.string()).default([]), // nötige Qualifikationen
  zeitfenster: zeitfensterSchema,
  dauerMin: z.number().int().positive().default(30), // Einsatzdauer
  // Kostenträger aus dem übernommenen Bedarf (Abrechnung).
  kostentraegerArt: z.enum(KOSTENTRAEGER_ARTEN).optional(),
  krankenversicherer: z.string().optional(),
  bezugspflege: z.string().optional(), // bevorzugte Pflegekraft (Pflegekraft-Id)
  status: statusSchema.default('aktiv'),
})
export type KlientOperativ = z.infer<typeof klientOperativSchema>

// Ein Einsatz innerhalb einer Tour.
export const einsatzSchema = z.object({
  pseudonymId: pseudonymIdSchema,
  geo: geoSchema,
  zeitfenster: zeitfensterSchema,
  dauerMin: z.number().int().positive().default(30),
  qualifikation: z.array(z.string()).default([]),
  // Geplante Ankunftszeit (Minuten seit Mitternacht), vom Planer gesetzt.
  ankunft: z.number().int().min(0).max(1439).optional(),
  // Probe-Einplanung: ein offener Marktplatz-Bedarf, der noch nicht gewonnen
  // ist — unverbindliche Kapazitätsplanung, klar gekennzeichnet.
  probe: z.boolean().optional(),
})
export type Einsatz = z.infer<typeof einsatzSchema>

// Eine Tour (Säule 2): eine Pflegekraft, ein Tag, eine Einsatzfolge.
export const tourSchema = z.object({
  id: z.string(),
  tenantId: z.string().min(1),
  datum: z.string(), // ISO-Datum (YYYY-MM-DD)
  pflegekraftId: z.string(),
  pflegekraftQualifikation: z.array(z.string()).default([]),
  start: geoSchema, // Startpunkt (Standort/Depot)
  startZeit: z.number().int().min(0).max(1439).default(480), // 08:00
  einsaetze: z.array(einsatzSchema).default([]),
})
export type Tour = z.infer<typeof tourSchema>

// ── Fit-Score (Matching) ─────────────────────────────────────────────────

export const fitScoreRequestSchema = z.object({
  tenantId: z.string().min(1),
  // Der einzufügende Klient/Bedarf.
  kandidat: z.object({
    pseudonymId: pseudonymIdSchema.optional(),
    geo: geoSchema,
    zeitfenster: zeitfensterSchema,
    dauerMin: z.number().int().positive().default(30),
    qualifikation: z.array(z.string()).default([]),
  }),
  // Touren, gegen die geprüft wird (optional — sonst lädt die API alle).
  tourIds: z.array(z.string()).optional(),
})
export type FitScoreRequest = z.infer<typeof fitScoreRequestSchema>

// Ein Treffer: in welche Tour, an welcher Position, mit welchem Mehrweg.
export const fitMatchSchema = z.object({
  tourId: z.string(),
  pflegekraftId: z.string(),
  // Marginaler Mehrweg in Minuten (geringer = besser).
  mehrwegMin: z.number(),
  // 0-basierte Position in der Einsatzfolge.
  position: z.number().int(),
  // Geplante Ankunft des Kandidaten an dieser Position.
  ankunft: z.number().int(),
  qualifikationOk: z.literal(true),
})
export type FitMatch = z.infer<typeof fitMatchSchema>

export const fitScoreResponseSchema = z.object({
  matches: z.array(fitMatchSchema), // sortiert nach Mehrweg aufsteigend
  geprueft: z.number().int(), // Anzahl geprüfter Touren
  rechenzeitMs: z.number(),
})
export type FitScoreResponse = z.infer<typeof fitScoreResponseSchema>
