import { z } from 'zod'
import { geoSchema, zeitfensterSchema, pseudonymIdSchema } from './domain'
import { KOSTENTRAEGER_ARTEN } from './krankenkassen'
import { BUNDESLAENDER } from './leistungskomplexe'
import { ABWESENHEITEN, WOHNSITUATIONEN, KONTAKTARTEN } from './leistungsgruppen'

// Kostenträger eines Bedarfs (gesetzlich/privat) — für bietende Dienste wichtig.
export const kostentraegerArtSchema = z.enum(KOSTENTRAEGER_ARTEN)

// Auswahl je Leistungsgruppe (Klartext) + Häufigkeit (Screenshot Schritt 2).
export const leistungsgruppenAuswahlSchema = z.object({
  positionen: z.array(z.string()).default([]), // angekreuzte Einzelleistungen
  andere: z.string().optional(), // „andere Leistungen" (Freitext)
  beschreibung: z.string().optional(), // Begleitung/Betreuung: Freitext
  tageProWoche: z.number().int().min(0).max(7).optional(),
  malProTag: z.number().int().min(0).max(24).optional(),
})
export type LeistungsgruppenAuswahl = z.infer<typeof leistungsgruppenAuswahlSchema>

// Neue operative Felder (Säule 2, pseudonym) aus dem 3-Schritt-Formular.
// Additiv/optional — der phasenweise Umbau bricht bestehende Consumer nicht.
const neueOperativeFelder = {
  bundesland: z.enum(BUNDESLAENDER).optional(),
  stadtteil: z.string().optional(),
  alter: z.number().int().min(1).max(120).optional(),
  wohnsituation: z.enum(WOHNSITUATIONEN).optional(),
  startDatum: z.string().optional(), // ISO-Datum: ab wann Pflege benötigt
  abwesenheiten: z.array(z.enum(ABWESENHEITEN)).default([]),
  abwesenheitErlaeuterung: z.string().optional(),
  besonderheiten: z.string().optional(), // Sprache, gleichgeschlechtliche Pflege …
  // Leistungsauswahl je Gruppe (Schlüssel = Gruppen-Key aus leistungsgruppen.ts).
  leistungsauswahl: z.record(z.string(), leistungsgruppenAuswahlSchema).optional(),
}

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
  // Kostenträger: Art (GKV/PKV) + konkrete Kasse — für die Abrechnung des Dienstes.
  kostentraegerArt: kostentraegerArtSchema.optional(),
  krankenversicherer: z.string().optional(),
  ...neueOperativeFelder,
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
  // Gesetzt, sobald der Dienst den (gewonnenen) Bedarf als Klient in die
  // Tourenplanung übernommen hat — verhindert doppelte Übernahme.
  uebernommenAt: z.string().optional(),
})
export type Bedarf = z.infer<typeof bedarfSchema>

// Kontaktdaten der Angehörigen (PII → Säule 1, verschlüsselt).
export const kontaktSchema = z.object({
  vorname: z.string().min(1),
  nachname: z.string().min(1),
  telefon: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  adresse: z.string().optional(),
  // Erweiterte Kontaktangaben (Screenshot Schritt 3) — additiv/optional.
  beratungsstelle: z.string().optional(), // Beratungsstelle/Sozialdienst, Aktenzeichen
  kontaktart: z.array(z.enum(KONTAKTARTEN)).optional(), // gewünschte Kontaktart
  kontaktzeitraum: z.string().optional(), // gewünschter Zeitraum der Kontaktaufnahme
})
export type Kontakt = z.infer<typeof kontaktSchema>

// Eingabe beim Einstellen eines Bedarfs: operative Daten + Kontakt.
export const bedarfErstellenSchema = z
  .object({
    geo: geoSchema,
    pflegegrad: z.number().int().min(1).max(5).optional(),
    leistungen: z.array(z.string()).default([]),
    qualifikation: z.array(z.string()).default([]),
    // Kostenträger optional; Kasse nur sinnvoll mit gewählter Art.
    kostentraegerArt: kostentraegerArtSchema.optional(),
    krankenversicherer: z.string().optional(),
    ...neueOperativeFelder,
    zeitfenster: zeitfensterSchema,
    dauerMin: z.number().int().positive().default(30),
    express: z.boolean().default(false),
    kontakt: kontaktSchema,
    // Pflicht-Einwilligung (Art. 9 DSGVO) — muss true sein, sonst kein Bedarf.
    einwilligung: z.literal(true),
  })
  // Eine konkrete Kasse ergibt nur Sinn, wenn auch die Art gewählt wurde.
  .refine((d) => !d.krankenversicherer || !!d.kostentraegerArt, {
    message: 'Krankenversicherer ohne Kostenträger-Art ist nicht zulässig',
    path: ['kostentraegerArt'],
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
