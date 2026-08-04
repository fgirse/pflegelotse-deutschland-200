import { z } from 'zod'

// ── Klient bearbeiten (zod) ───────────────────────────────────────────────
// Deckt beide Säulen ab: Identität (PII → Säule 1) und operative Merkmale
// (Säule 2). Leere Strings sind erlaubt (Feld leeren). Der Server schreibt
// jede Hälfte in ihre Collection.

const optDatum = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional()

export const klientBearbeitenSchema = z.object({
  // Säule 1 (Identität)
  vorname: z.string().max(100).default(''),
  nachname: z.string().max(100).default(''),
  geburtsdatum: optDatum,
  adresse: z.string().max(200).default(''),
  telefon: z.string().max(50).default(''),
  email: z.union([z.string().email('Bitte eine gültige E-Mail'), z.literal('')]).optional(),
  // Säule 2 (operativ)
  kostentraegerArt: z.union([z.enum(['gesetzlich', 'privat']), z.literal('')]).optional(),
  krankenversicherer: z.string().max(120).default(''),
  leistungen: z.array(z.string().max(16)).default([]),
  pflegegrad: z.union([z.number().int().min(1).max(5), z.null()]).optional(),
  status: z.enum(['aktiv', 'pausiert', 'beendet']).default('aktiv'),
})
export type KlientBearbeiten = z.infer<typeof klientBearbeitenSchema>

// Anlegen = Bearbeiten-Felder + operative Pflichtfelder (Koordinaten aus der
// Adresse geocodiert, Zeitfenster). Dauer/Qualifikation leitet der Server aus
// den Leistungen über den Katalog ab.
export const klientAnlegenSchema = klientBearbeitenSchema.extend({
  geo: z.object({ lat: z.number(), lng: z.number() }),
  zeitfenster: z.object({
    von: z.number().int().min(0).max(1439),
    bis: z.number().int().min(0).max(1439),
  }),
})
export type KlientAnlegen = z.infer<typeof klientAnlegenSchema>
