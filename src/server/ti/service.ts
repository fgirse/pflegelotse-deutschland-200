import { randomUUID } from 'node:crypto'
import { geocode } from '@/server/geo/service'
import {
  existiertVerordnung,
  erstelleVerordnung,
  erstelleIdentitaet,
  erstelleKlientOperativ,
} from '@/server/repo'
import { mappeEvo, type EvoNutzlast } from './evo'
import { KimVersandStub } from './stubs'
import type { KimVersand } from './ports'

// KIM-Versand als Port; im Dev der Stub (Console). Später zertifizierter Adapter.
const kim: KimVersand = new KimVersandStub()

export type EvoStatus = 'angelegt' | 'bereits_verarbeitet' | 'geocoding_fehlgeschlagen'

// Verarbeitet eine eingehende eVerordnung (§8.2): idempotent über verordnungId;
// legt Patient-Identität (Säule 1) und operativen Klienten + Verordnung (Säule 2)
// an; schickt eine Rückmeldung an die verordnende Stelle (KIM-Stub).
export async function verarbeiteEvo(
  tenantId: string,
  nutzlast: EvoNutzlast,
): Promise<{ status: EvoStatus; verordnungId: string; pseudonymId?: string }> {
  // Idempotenz: dieselbe Verordnung nicht doppelt anlegen.
  if (await existiertVerordnung(tenantId, nutzlast.verordnungId)) {
    return { status: 'bereits_verarbeitet', verordnungId: nutzlast.verordnungId }
  }

  // Adresse → Koordinaten (für die spätere Tourenplanung).
  const treffer = await geocode(nutzlast.patient.adresse)
  if (!treffer) {
    return { status: 'geocoding_fehlgeschlagen', verordnungId: nutzlast.verordnungId }
  }

  const pseudonymId = randomUUID()
  const m = mappeEvo(nutzlast, tenantId, { lat: treffer.lat, lng: treffer.lng }, pseudonymId, new Date().toISOString())

  await erstelleIdentitaet(m.identitaet)
  await erstelleKlientOperativ(m.operativ)
  await erstelleVerordnung(m.verordnung)

  // Rückmeldung an die verordnende Stelle (Empfang bestätigt).
  if (nutzlast.verordnetVon) {
    await kim.sende({
      an: nutzlast.verordnetVon,
      betreff: `Verordnung ${nutzlast.verordnungId} übernommen`,
      text: `Die Verordnung ${nutzlast.verordnungId} wurde übernommen und in die Versorgung eingeplant.`,
    })
  }

  return { status: 'angelegt', verordnungId: nutzlast.verordnungId, pseudonymId }
}
