import { payloadClient } from '@/server/payloadClient'
import type { KlientBearbeiten } from '@/shared/klient'
import type { KlientListenZeile } from './liste'

// Speichert einen Klienten über BEIDE Säulen: Identität (Säule 1, verschlüsselt)
// und operative Merkmale (Säule 2). Streng mandantengebunden — der Klient muss
// als operativer Datensatz im eigenen Mandanten existieren.
export async function speichereKlient(
  tenantId: string,
  pseudonymId: string,
  daten: KlientBearbeiten,
): Promise<KlientListenZeile | null> {
  const payload = await payloadClient()

  // Operativen Datensatz laden (Zugehörigkeit + id).
  const op = await payload.find({
    collection: 'klienten_operativ',
    where: { and: [{ tenantId: { equals: tenantId } }, { pseudonymId: { equals: pseudonymId } }] },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  const opDoc = op.docs[0] as { id: string | number } | undefined
  if (!opDoc) return null

  // Säule 2 aktualisieren.
  await payload.update({
    collection: 'klienten_operativ',
    id: opDoc.id,
    data: {
      kostentraegerArt: daten.kostentraegerArt ? daten.kostentraegerArt : null,
      krankenversicherer: daten.krankenversicherer || null,
      leistungen: daten.leistungen,
      pflegegrad: daten.pflegegrad ?? null,
      status: daten.status,
    },
    overrideAccess: true,
  })

  // Säule 1 aktualisieren (oder anlegen, falls noch keine Identität existiert).
  const idPii = {
    vorname: daten.vorname,
    nachname: daten.nachname,
    geburtsdatum: daten.geburtsdatum || '',
    adresse: daten.adresse,
    telefon: daten.telefon,
    email: daten.email || '',
  }
  const id = await payload.find({
    collection: 'klienten_identitaet',
    where: { and: [{ tenantId: { equals: tenantId } }, { pseudonymId: { equals: pseudonymId } }] },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  const idDoc = id.docs[0] as { id: string | number } | undefined
  if (idDoc) {
    await payload.update({ collection: 'klienten_identitaet', id: idDoc.id, data: idPii, overrideAccess: true })
  } else {
    await payload.create({
      collection: 'klienten_identitaet',
      data: { pseudonymId, tenantId, ...idPii },
      overrideAccess: true,
    })
  }

  return {
    pseudonymId,
    vorname: daten.vorname,
    nachname: daten.nachname,
    geburtsdatum: daten.geburtsdatum || undefined,
    adresse: daten.adresse || undefined,
    telefon: daten.telefon || undefined,
    email: daten.email || undefined,
    kostentraegerArt: daten.kostentraegerArt || undefined,
    krankenversicherer: daten.krankenversicherer || undefined,
    leistungen: daten.leistungen,
    pflegegrad: daten.pflegegrad ?? undefined,
    status: daten.status,
  }
}
