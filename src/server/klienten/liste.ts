import { payloadClient } from '@/server/payloadClient'

// Eine Zeile der Klientenliste: Identität (Säule 1, entschlüsselt) + operative
// Merkmale (Säule 2), zusammengeführt über die pseudonymId. Nur für den eigenen
// Mandanten (Disponent/Admin).
export interface KlientListenZeile {
  pseudonymId: string
  vorname: string
  nachname: string
  geburtsdatum?: string
  adresse?: string
  telefon?: string
  email?: string
  kostentraegerArt?: 'gesetzlich' | 'privat'
  krankenversicherer?: string
  leistungen: string[]
  pflegegrad?: number
  status: string
}

type OpDoc = {
  pseudonymId?: string
  kostentraegerArt?: 'gesetzlich' | 'privat' | null
  krankenversicherer?: string | null
  leistungen?: unknown
  pflegegrad?: number | null
  status?: string | null
}
type IdDoc = {
  pseudonymId?: string
  vorname?: string
  nachname?: string
  geburtsdatum?: string
  adresse?: string
  telefon?: string
  email?: string
}

// Lädt alle Klienten eines Mandanten als zusammengeführte Liste (nach Nachname).
export async function ladeKlientenListe(tenantId: string): Promise<KlientListenZeile[]> {
  const payload = await payloadClient()
  const [op, id] = await Promise.all([
    payload.find({
      collection: 'klienten_operativ',
      where: { tenantId: { equals: tenantId } },
      limit: 500,
      overrideAccess: true,
      depth: 0,
    }),
    payload.find({
      collection: 'klienten_identitaet',
      where: { tenantId: { equals: tenantId } },
      limit: 500,
      overrideAccess: true,
      depth: 0,
    }),
  ])

  const idMap = new Map<string, IdDoc>()
  for (const d of id.docs as IdDoc[]) if (d.pseudonymId) idMap.set(d.pseudonymId, d)

  const zeilen: KlientListenZeile[] = (op.docs as OpDoc[]).map((o) => {
    const i = (o.pseudonymId && idMap.get(o.pseudonymId)) || {}
    return {
      pseudonymId: o.pseudonymId ?? '',
      vorname: i.vorname ?? '',
      nachname: i.nachname ?? '',
      geburtsdatum: i.geburtsdatum || undefined,
      adresse: i.adresse || undefined,
      telefon: i.telefon || undefined,
      email: i.email || undefined,
      kostentraegerArt: o.kostentraegerArt ?? undefined,
      krankenversicherer: o.krankenversicherer || undefined,
      leistungen: Array.isArray(o.leistungen) ? (o.leistungen as string[]) : [],
      pflegegrad: typeof o.pflegegrad === 'number' ? o.pflegegrad : undefined,
      status: o.status ?? 'aktiv',
    }
  })

  return zeilen.sort(
    (a, b) => a.nachname.localeCompare(b.nachname) || a.vorname.localeCompare(b.vorname),
  )
}
