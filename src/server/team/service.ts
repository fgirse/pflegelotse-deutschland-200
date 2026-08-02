import { randomBytes } from 'node:crypto'
import { payloadClient } from '@/server/payloadClient'
import type { MitarbeiterAnlegen, MitarbeiterZeile } from '@/shared/mitarbeiter'

// Lesbares Zufallspasswort ohne verwechselbare Zeichen (kein l/1/I, o/0/O).
const PW_CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generierePasswort(laenge = 12): string {
  const bytes = randomBytes(laenge)
  let out = ''
  for (let i = 0; i < laenge; i++) out += PW_CHARS[bytes[i] % PW_CHARS.length]
  return out
}

// Über die Team-Verwaltung verwaltbare Dienst-Rollen (kein Admin/Plattform).
const VERWALTBARE_ROLLEN = ['pflegekraft', 'disponent']

// Bildet einen Payload-User auf die schlanke Team-Zeile ab (ohne Geheimnisse).
function zuZeile(d: {
  id: string | number
  email?: string
  role?: string | null
  pflegekraftId?: string | null
  totpEnabled?: boolean | null
  deaktiviert?: boolean | null
  createdAt?: string
}): MitarbeiterZeile {
  return {
    id: String(d.id),
    email: d.email ?? '',
    rolle: d.role === 'disponent' ? 'disponent' : 'pflegekraft',
    pflegekraftId: d.pflegekraftId ?? undefined,
    totpEnabled: Boolean(d.totpEnabled),
    deaktiviert: Boolean(d.deaktiviert),
    erstelltAm: d.createdAt,
  }
}

// Listet alle Mitarbeiter (Pflegekräfte + Disponenten) eines Mandanten.
export async function listeMitarbeiter(tenantId: string): Promise<MitarbeiterZeile[]> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'users',
    where: {
      and: [{ tenantId: { equals: tenantId } }, { role: { in: VERWALTBARE_ROLLEN } }],
    },
    limit: 200,
    sort: '-createdAt',
    overrideAccess: true,
  })
  return res.docs.map((d) => zuZeile(d as Parameters<typeof zuZeile>[0]))
}

export type AnlegenErgebnis =
  | { status: 'ok'; mitarbeiter: MitarbeiterZeile }
  | { status: 'email_existiert' }

// Legt einen Mitarbeiter (Pflegekraft oder Disponent) im Mandanten des Admins
// an. Rolle auf verwaltbare Werte begrenzt (Schema), tenantId AUSSCHLIESSLICH
// aus der Admin-Sitzung (nie aus dem Client).
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
      role: eingabe.rolle,
      tenantId, // serverseitig aus der Admin-Sitzung
      // Initial-Passwort vom Admin → beim ersten Login zwingend wechseln.
      passwortWechselErforderlich: true,
      // Kürzel nur bei Pflegekräften (Tour-Bindung); bei Disponenten ignoriert.
      ...(eingabe.rolle === 'pflegekraft' && eingabe.pflegekraftId
        ? { pflegekraftId: eingabe.pflegekraftId }
        : {}),
    },
    overrideAccess: true,
  })
  return { status: 'ok', mitarbeiter: zuZeile(doc as Parameters<typeof zuZeile>[0]) }
}

// Lädt einen Mitarbeiter NUR, wenn er zum Mandanten des Admins gehört und eine
// verwaltbare Rolle (Pflegekraft/Disponent) hat. Verhindert Zugriff auf fremde
// Mandanten oder andere Rollen (z. B. einen anderen Admin deaktivieren/löschen).
async function ladeEigenenMitarbeiter(tenantId: string, id: string) {
  const payload = await payloadClient()
  const doc = (await payload
    .findByID({ collection: 'users', id, overrideAccess: true })
    .catch(() => null)) as
    | { id: string | number; role?: string; tenantId?: string }
    | null
  if (!doc || !doc.role || !VERWALTBARE_ROLLEN.includes(doc.role) || doc.tenantId !== tenantId) {
    return null
  }
  return doc
}

// Deaktiviert/aktiviert eine Pflegekraft (Offboarding, reversibel).
export async function setzeMitarbeiterStatus(
  tenantId: string,
  id: string,
  deaktiviert: boolean,
): Promise<MitarbeiterZeile | null> {
  if (!(await ladeEigenenMitarbeiter(tenantId, id))) return null
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
  if (!(await ladeEigenenMitarbeiter(tenantId, id))) return false
  const payload = await payloadClient()
  await payload.delete({ collection: 'users', id, overrideAccess: true })
  return true
}

// Setzt ein neues Initial-Passwort (z. B. bei „vergessen") und erzwingt den
// Wechsel beim nächsten Login. Gibt das Klartext-Passwort EINMALIG zurück,
// damit der Admin es der Pflegekraft übergeben kann.
export async function setzeInitialPasswort(
  tenantId: string,
  id: string,
): Promise<string | null> {
  if (!(await ladeEigenenMitarbeiter(tenantId, id))) return null
  const payload = await payloadClient()
  const tempPasswort = generierePasswort()
  await payload.update({
    collection: 'users',
    id,
    data: { password: tempPasswort, passwortWechselErforderlich: true },
    overrideAccess: true,
  })
  return tempPasswort
}

// Setzt die 2FA zurück (verlorenes Gerät): Secret löschen, deaktivieren. Beim
// nächsten Login läuft die Ersteinrichtung erneut.
export async function resette2faMitarbeiter(
  tenantId: string,
  id: string,
): Promise<MitarbeiterZeile | null> {
  if (!(await ladeEigenenMitarbeiter(tenantId, id))) return null
  const payload = await payloadClient()
  const doc = await payload.update({
    collection: 'users',
    id,
    data: { totpSecret: null, totpEnabled: false },
    overrideAccess: true,
  })
  return zuZeile(doc as Parameters<typeof zuZeile>[0])
}
