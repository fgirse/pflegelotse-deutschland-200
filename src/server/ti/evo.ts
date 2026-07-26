import { z } from 'zod'

// ── eVerordnung (§8.2, vereinfachtes JSON) ────────────────────────────────
// Bewusst NICHT das KBV-FHIR-Vollprofil, sondern die fachlich nötigen Felder.
// Der Transport (KIM/Konnektor/SMC-B) ist gestubbt; das Mapping ist real und
// wahrt die Zwei-Säulen-Trennung: Patient-Identität → Säule 1, verordnete
// Leistungen/Zeitraum → Säule 2 (operativ).

export const evoSchema = z.object({
  // Eindeutige Verordnungs-ID (Idempotenz).
  verordnungId: z.string().min(1),
  patient: z.object({
    vorname: z.string().min(1),
    nachname: z.string().min(1),
    adresse: z.string().min(1),
    versichertennummer: z.string().optional(),
    geburtsdatum: z.string().optional(),
  }),
  pflegegrad: z.number().int().min(1).max(5).optional(),
  // Verordnete Leistungskomplexe (z. B. "LK01").
  leistungen: z.array(z.string()).min(1),
  // Verordnungszeitraum (ISO YYYY-MM-DD).
  zeitraum: z.object({ von: z.string(), bis: z.string() }),
  // Verordnende Stelle (LANR/BSNR/Praxis) — KEIN Patienten-PII.
  verordnetVon: z.string().optional(),
})
export type EvoNutzlast = z.infer<typeof evoSchema>

export interface EvoMapping {
  // Säule 1 (PII, CSFLE).
  identitaet: {
    pseudonymId: string
    tenantId: string
    externalId?: string
    vorname: string
    nachname: string
    adresse: string
  }
  // Säule 2 (operativ, pseudonym).
  operativ: {
    pseudonymId: string
    tenantId: string
    geo: { lat: number; lng: number }
    pflegegrad?: number
    leistungen: string[]
    qualifikation: string[]
    zeitfenster: { von: number; bis: number }
    dauerMin: number
    status: 'aktiv'
  }
  // Verordnungs-Aufzeichnung (Säule 2, kein PII).
  verordnung: {
    verordnungId: string
    tenantId: string
    pseudonymId: string
    leistungen: string[]
    zeitraumVon: string
    zeitraumBis: string
    pflegegrad?: number
    verordnetVon?: string
    eingegangenAm: string
  }
}

// Bildet eine validierte eVO auf die drei Datensätze ab. geo (aus Geocoding),
// pseudonymId und Zeitstempel werden injiziert (deterministisch/testbar).
export function mappeEvo(
  n: EvoNutzlast,
  tenantId: string,
  geo: { lat: number; lng: number },
  pseudonymId: string,
  eingegangenAm: string,
): EvoMapping {
  return {
    identitaet: {
      pseudonymId,
      tenantId,
      externalId: n.patient.versichertennummer ? `kvnr:${n.patient.versichertennummer}` : undefined,
      vorname: n.patient.vorname,
      nachname: n.patient.nachname,
      adresse: n.patient.adresse,
    },
    operativ: {
      pseudonymId,
      tenantId,
      geo,
      pflegegrad: n.pflegegrad,
      leistungen: n.leistungen,
      qualifikation: [],
      zeitfenster: { von: 480, bis: 1020 }, // Standard 08:00–17:00
      dauerMin: 30,
      status: 'aktiv',
    },
    verordnung: {
      verordnungId: n.verordnungId,
      tenantId,
      pseudonymId,
      leistungen: n.leistungen,
      zeitraumVon: n.zeitraum.von,
      zeitraumBis: n.zeitraum.bis,
      pflegegrad: n.pflegegrad,
      verordnetVon: n.verordnetVon,
      eingegangenAm,
    },
  }
}
