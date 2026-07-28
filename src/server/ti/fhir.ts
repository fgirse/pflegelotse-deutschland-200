import type { EvoNutzlast } from './evo'
import { mappeLeistungsCode } from './leistungsCodes'

// ── KBV-FHIR → internes eVO-Modell (§8.2) ─────────────────────────────────
// Toleranter Subset-Parser: liest aus einem FHIR-Bundle die fachlich nötigen
// Felder (Patient, ServiceRequest, Practitioner/Organization) und bildet sie auf
// EvoNutzlast ab. KEIN vollständiger KBV-Profil-Konformitätscheck (StructureDef/
// Terminologie) — unbekannte Felder werden ignoriert.

// Standard-NamingSystems (Ausschnitt).
const KVNR_HINT = 'kvid' // http://fhir.de/sid/gkv/kvid-10
const ANR_HINT = 'ANR' // https://fhir.kbv.de/NamingSystem/KBV_NS_Base_ANR (LANR)

function findeIdentifier(identifiers: unknown, systemHinweis: string): string | undefined {
  if (!Array.isArray(identifiers)) return undefined
  const treffer = identifiers.find(
    (i) => typeof i?.system === 'string' && i.system.toLowerCase().includes(systemHinweis.toLowerCase()),
  )
  return (treffer ?? identifiers[0])?.value
}

// FHIR-dateTime → YYYY-MM-DD.
const datumTeil = (s: unknown): string => (typeof s === 'string' ? s.slice(0, 10) : '')

export function mappeFhirBundle(bundle: unknown): { ok: EvoNutzlast } | { fehler: string } {
  const b = bundle as any
  if (!b || b.resourceType !== 'Bundle' || !Array.isArray(b.entry)) {
    return { fehler: 'Kein FHIR-Bundle' }
  }
  const resourcen = b.entry.map((e: any) => e?.resource).filter(Boolean)
  const patient = resourcen.find((r: any) => r.resourceType === 'Patient')
  const serviceRequests = resourcen.filter((r: any) => r.resourceType === 'ServiceRequest')
  const verordner = resourcen.find((r: any) => r.resourceType === 'Practitioner' || r.resourceType === 'Organization')

  if (!patient) return { fehler: 'Patient fehlt im Bundle' }
  if (serviceRequests.length === 0) return { fehler: 'ServiceRequest (Leistung) fehlt im Bundle' }

  // Patient → Säule-1-Felder.
  const name = patient.name?.[0] ?? {}
  const vorname = (Array.isArray(name.given) ? name.given.join(' ') : '').trim()
  const nachname = (name.family ?? '').trim()
  if (!vorname || !nachname) return { fehler: 'Patientenname unvollständig' }
  const adr = patient.address?.[0] ?? {}
  const adresse = [
    Array.isArray(adr.line) ? adr.line.join(' ') : '',
    [adr.postalCode, adr.city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ')
  if (!adresse) return { fehler: 'Patientenadresse fehlt' }
  const versichertennummer = findeIdentifier(patient.identifier, KVNR_HINT)

  // Leistungen: alle Codings aller ServiceRequests → interne Codes.
  const rohCodes: string[] = []
  for (const sr of serviceRequests) {
    for (const c of sr.code?.coding ?? []) if (c?.code) rohCodes.push(String(c.code))
  }
  const leistungen = [...new Set(rohCodes.map(mappeLeistungsCode))]
  if (leistungen.length === 0) return { fehler: 'Keine Leistungscodes im ServiceRequest' }

  // Zeitraum aus dem ersten ServiceRequest mit occurrencePeriod.
  const period = serviceRequests.map((sr: any) => sr.occurrencePeriod).find((p: any) => p?.start && p?.end)
  if (!period) return { fehler: 'Verordnungszeitraum (occurrencePeriod) fehlt' }
  const zeitraum = { von: datumTeil(period.start), bis: datumTeil(period.end) }

  // Verordnungs-ID: Bundle- oder ServiceRequest-Identifier.
  const verordnungId = b.identifier?.value ?? serviceRequests[0].identifier?.[0]?.value
  if (!verordnungId) return { fehler: 'Verordnungs-ID fehlt' }

  const verordnetVon = findeIdentifier(verordner?.identifier, ANR_HINT)

  return {
    ok: {
      verordnungId: String(verordnungId),
      patient: { vorname, nachname, adresse, versichertennummer },
      leistungen,
      zeitraum,
      verordnetVon,
    },
  }
}
