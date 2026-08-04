import { payloadClient } from '@/server/payloadClient'
import { neuePseudonymId } from '@/lib/pseudonym'
import { ladeKatalogMap, standardzeitenAusKatalog } from '@/server/leistungen/service'
import type { KlientAnlegen } from '@/shared/klient'
import type { KlientListenZeile } from './liste'

// Legt einen neuen Klienten über BEIDE Säulen an: operativer Datensatz (Säule 2)
// und Identität (Säule 1, verschlüsselt). Dauer und geforderte Qualifikation
// werden aus den Leistungen über den Katalog abgeleitet (Fallback: 30 Min.).
export async function erstelleKlient(
  tenantId: string,
  daten: KlientAnlegen,
): Promise<KlientListenZeile> {
  const payload = await payloadClient()
  const pseudonymId = neuePseudonymId()

  const katalog = await ladeKatalogMap(tenantId)
  const abgeleitet = standardzeitenAusKatalog(daten.leistungen, katalog)

  await payload.create({
    collection: 'klienten_operativ',
    data: {
      pseudonymId,
      tenantId,
      geo: daten.geo,
      zeitfenster: daten.zeitfenster,
      leistungen: daten.leistungen,
      qualifikation: abgeleitet.qualifikation,
      dauerMin: abgeleitet.dauerMin ?? 30,
      pflegegrad: daten.pflegegrad ?? null,
      kostentraegerArt: daten.kostentraegerArt ? daten.kostentraegerArt : null,
      krankenversicherer: daten.krankenversicherer || null,
      status: daten.status,
    },
    overrideAccess: true,
  })

  await payload.create({
    collection: 'klienten_identitaet',
    data: {
      pseudonymId,
      tenantId,
      vorname: daten.vorname,
      nachname: daten.nachname,
      geburtsdatum: daten.geburtsdatum || '',
      adresse: daten.adresse,
      telefon: daten.telefon,
      email: daten.email || '',
    },
    overrideAccess: true,
  })

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
