import { z } from 'zod'

// ── Leistungskatalog (§5.1.3) ─────────────────────────────────────────────
// Mandantengebundener Katalog der Leistungskomplexe mit Standardzeiten. Preis
// liegt weiterhin in der Abrechnungskonfiguration; der Katalog-Screen editiert
// ihn mit (Service schreibt ihn dorthin).

export const leistungSpeichernSchema = z.object({
  bezeichnung: z.string().min(1, 'Bezeichnung fehlt').max(120),
  qualifikation: z.enum(['grundpflege', 'behandlungspflege']).optional(),
  dauerMin: z.number().int().min(0).max(600).optional(),
  grundzeitMin: z.number().int().min(0).max(600).optional(),
  // Euro; wird in Abrechnungskonfiguration.preise[code] geschrieben (GKV-Satz).
  preis: z.number().min(0).max(100000).optional(),
  // Privatsatz (PKV) — wird in Abrechnungskonfiguration.preisePrivat[code]
  // geschrieben. Fehlt er, gilt in der Abrechnung der GKV-Satz als Fallback.
  preisPrivat: z.number().min(0).max(100000).optional(),
  aktiv: z.boolean().default(true),
})
export type LeistungSpeichern = z.infer<typeof leistungSpeichernSchema>

// Zeile für Liste/Editor (inkl. Code und Preisen).
export interface LeistungEintrag {
  code: string
  bezeichnung: string
  qualifikation?: 'grundpflege' | 'behandlungspflege'
  dauerMin?: number
  grundzeitMin?: number
  preis?: number
  preisPrivat?: number
  aktiv: boolean
}
