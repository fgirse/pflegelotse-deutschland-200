import { payloadClient } from '@/server/payloadClient'
import type { MitarbeiterAnlegen, MitarbeiterZeile } from '@/shared/mitarbeiter'

// Bildet einen Payload-User auf die schlanke Team-Zeile ab (ohne Geheimnisse).
function zuZeile(d: {
  id: string | number
  email?: string
  pflegekraftId?: string | null
  totpEnabled?: boolean | null
  createdAt?: string
}): MitarbeiterZeile {
  return {
    id: String(d.id),
    email: d.email ?? '',
    pflegekraftId: d.pflegekraftId ?? undefined,
    totpEnabled: Boolean(d.totpEnabled),
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
      ...(eingabe.pflegekraftId ? { pflegekraftId: eingabe.pflegekraftId } : {}),
    },
    overrideAccess: true,
  })
  return { status: 'ok', mitarbeiter: zuZeile(doc as Parameters<typeof zuZeile>[0]) }
}
