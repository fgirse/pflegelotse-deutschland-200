import { payloadClient } from '@/server/payloadClient'

export interface KlientIdentitaet {
  vorname: string
  nachname: string
  adresse: string
  telefon?: string
}

// Liest die Klartext-Identität (Säule 1, per piiFeld-Hooks entschlüsselt) eines
// EIGENEN Klienten zu seiner pseudonymId. Streng mandantengebunden.
export async function ladeKlientIdentitaet(
  tenantId: string,
  pseudonymId: string,
): Promise<KlientIdentitaet | null> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'klienten_identitaet',
    where: { and: [{ tenantId: { equals: tenantId } }, { pseudonymId: { equals: pseudonymId } }] },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  const d = res.docs[0] as
    | { vorname?: string; nachname?: string; adresse?: string; telefon?: string }
    | undefined
  if (!d) return null
  return {
    vorname: d.vorname ?? '',
    nachname: d.nachname ?? '',
    adresse: d.adresse ?? '',
    telefon: d.telefon || undefined,
  }
}
