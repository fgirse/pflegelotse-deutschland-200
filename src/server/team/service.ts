import { payloadClient } from '@/server/payloadClient'
import type { MitarbeiterAnlegen, MitarbeiterZeile } from '@/shared/mitarbeiter'

// Bildet einen Payload-User auf die schlanke Team-Zeile ab (ohne Geheimnisse).
function zuZeile(d: {
  id: string | number
  email?: string
  pflegekraftId?: string | null
  totpEnabled?: boolean | null
  deaktiviert?: boolean | null
  createdAt?: string
}): MitarbeiterZeile {
  return {
    id: String(d.id),
    email: d.email ?? '',
    pflegekraftId: d.pflegekraftId ?? undefined,
    totpEnabled: Boolean(d.totpEnabled),
    deaktiviert: Boolean(d.deaktiviert),
    erstelltAm: d.createdAt,
  }
}

// Listet alle Pflegekräfte eines Mandanten (neueste zuerst).
export async function listeMitarbeiter(tenantId: string): Promise<MitarbeiterZeile[]> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'users',
    where: { and: [{ tenantId: { equals: tenantId } }, { role: { equals: 'pflegekraft' } }] },
    limit: 200,
    sort: '-createdAt',
    overrideAccess: true,
  })
  return res.docs.map((d) => zuZeile(d as Parameters<typeof zuZeile>[0]))
}

export type AnlegenErgebnis =
  | { status: 'ok'; mitarbeiter: MitarbeiterZeile }
  | { status: 'email_existiert' }

// Legt eine Pflegekraft im Mandanten des Admins an. Rolle fest 'pflegekraft',
// tenantId AUSSCHLIESSLICH aus der Admin-Sitzung (nie aus dem Client).
export async function erstelleMitarbeiter(
  tenantId: string,
  eingabe: MitarbeiterAnlegen,
): Promise<AnlegenErgebnis> {
  const payload = await payloadClient()
  const email = eingabe.email.toLowerCase()

  // Doppelte E-Mail vorab abfangen (klare Meldung statt generischer 500).
  const vorhanden = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (vorhanden.docs.length > 0) return { status: 'email_existiert' }

  const doc = await payload.create({
    collection: 'users',
    data: {
      email,
      password: eingabe.password,
      role: 'pflegekraft',
      tenantId, // serverseitig aus der Admin-Sitzung
      // Initial-Passwort vom Admin → beim ersten Login zwingend wechseln.
      passwortWechselErforderlich: true,
      ...(eingabe.pflegekraftId ? { pflegekraftId: eingabe.pflegekraftId } : {}),
    },
    overrideAccess: true,
  })
  return { status: 'ok', mitarbeiter: zuZeile(doc as Parameters<typeof zuZeile>[0]) }
}

// Lädt eine Pflegekraft NUR, wenn sie zum Mandanten des Admins gehört und
// tatsächlich Rolle 'pflegekraft' hat. Verhindert Zugriff auf fremde Mandanten
// oder andere Rollen (z. B. einen anderen Admin deaktivieren/löschen).
async function ladeEigeneKraft(tenantId: string, id: string) {
  const payload = await payloadClient()
  const doc = (await payload
    .findByID({ collection: 'users', id, overrideAccess: true })
    .catch(() => null)) as
    | { id: string | number; role?: string; tenantId?: string }
    | null
  if (!doc || doc.role !== 'pflegekraft' || doc.tenantId !== tenantId) return null
  return doc
}

// Deaktiviert/aktiviert eine Pflegekraft (Offboarding, reversibel).
export async function setzeMitarbeiterStatus(
  tenantId: string,
  id: string,
  deaktiviert: boolean,
): Promise<MitarbeiterZeile | null> {
  if (!(await ladeEigeneKraft(tenantId, id))) return null
  const payload = await payloadClient()
  const doc = await payload.update({
    collection: 'users',
    id,
    data: { deaktiviert },
    overrideAccess: true,
  })
  return zuZeile(doc as Parameters<typeof zuZeile>[0])
}

// Löscht eine Pflegekraft endgültig. Die pseudonyme Historie (Säule 2, per
// pflegekraftId als String referenziert) bleibt davon unberührt.
export async function loescheMitarbeiter(tenantId: string, id: string): Promise<boolean> {
  if (!(await ladeEigeneKraft(tenantId, id))) return false
  const payload = await payloadClient()
  await payload.delete({ collection: 'users', id, overrideAccess: true })
  return true
}
