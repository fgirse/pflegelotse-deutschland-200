import { payloadClient } from '@/server/payloadClient'
import { LEISTUNGSKOMPLEXE } from '@/shared/leistungskomplexe'
import type { LeistungEintrag, LeistungSpeichern } from '@/shared/leistungskatalog'

type Payload = Awaited<ReturnType<typeof payloadClient>>

// Preise des Mandanten aus der Abrechnungskonfiguration (Single Source Preise).
async function ladePreise(payload: Payload, tenantId: string): Promise<Record<string, number>> {
  const res = await payload.find({
    collection: 'abrechnungskonfiguration',
    where: { tenantId: { equals: tenantId } },
    limit: 1,
    overrideAccess: true,
  })
  const d = res.docs[0] as { preise?: Record<string, number> } | undefined
  return d?.preise && typeof d.preise === 'object' ? d.preise : {}
}

type KatalogDoc = {
  code?: string
  bezeichnung?: string
  qualifikation?: 'grundpflege' | 'behandlungspflege' | null
  dauerMin?: number | null
  grundzeitMin?: number | null
  aktiv?: boolean | null
}

function zuEintrag(d: KatalogDoc, preise: Record<string, number>): LeistungEintrag {
  const code = d.code ?? ''
  return {
    code,
    bezeichnung: d.bezeichnung ?? '',
    qualifikation: d.qualifikation ?? undefined,
    dauerMin: typeof d.dauerMin === 'number' ? d.dauerMin : undefined,
    grundzeitMin: typeof d.grundzeitMin === 'number' ? d.grundzeitMin : undefined,
    preis: typeof preise[code] === 'number' ? preise[code] : undefined,
    aktiv: d.aktiv !== false,
  }
}

// Lädt den Katalog des Mandanten. Beim ersten Aufruf (leer) wird er aus dem
// Standard-Landeskatalog (Fallback) vorbefüllt — der Dienst bekommt eine
// editierbare Kopie und ergänzt Zeiten/Preise.
export async function ladeKatalog(tenantId: string): Promise<LeistungEintrag[]> {
  const payload = await payloadClient()
  const query = {
    collection: 'leistungskatalog' as const,
    where: { tenantId: { equals: tenantId } },
    limit: 500,
    sort: 'code',
    overrideAccess: true,
  }
  let res = await payload.find(query)
  if (res.docs.length === 0) {
    for (const lk of LEISTUNGSKOMPLEXE) {
      await payload.create({
        collection: 'leistungskatalog',
        data: {
          tenantId,
          code: lk.code,
          bezeichnung: lk.bezeichnung,
          aktiv: true,
          ...(lk.qualifikation ? { qualifikation: lk.qualifikation } : {}),
        },
        overrideAccess: true,
      })
    }
    res = await payload.find(query)
  }
  const preise = await ladePreise(payload, tenantId)
  return res.docs.map((d) => zuEintrag(d as KatalogDoc, preise))
}

// Schreibt den Preis in die Abrechnungskonfiguration (Upsert des Mandanten-Docs).
async function setzePreis(
  payload: Payload,
  tenantId: string,
  code: string,
  preis: number,
): Promise<void> {
  const res = await payload.find({
    collection: 'abrechnungskonfiguration',
    where: { tenantId: { equals: tenantId } },
    limit: 1,
    overrideAccess: true,
  })
  const doc = res.docs[0] as { id: string | number; preise?: Record<string, number> } | undefined
  if (doc) {
    const preise = { ...(doc.preise && typeof doc.preise === 'object' ? doc.preise : {}), [code]: preis }
    await payload.update({
      collection: 'abrechnungskonfiguration',
      id: doc.id,
      data: { preise },
      overrideAccess: true,
    })
  } else {
    await payload.create({
      collection: 'abrechnungskonfiguration',
      data: { tenantId, preise: { [code]: preis } },
      overrideAccess: true,
    })
  }
}

// Legt einen Katalog-Eintrag an oder aktualisiert ihn (Upsert je tenantId+code).
// Ein angegebener Preis wandert in die Abrechnungskonfiguration.
export async function speichereLeistung(
  tenantId: string,
  code: string,
  daten: LeistungSpeichern,
): Promise<LeistungEintrag> {
  const payload = await payloadClient()
  const vorhanden = await payload.find({
    collection: 'leistungskatalog',
    where: { and: [{ tenantId: { equals: tenantId } }, { code: { equals: code } }] },
    limit: 1,
    overrideAccess: true,
  })
  const data = {
    tenantId,
    code,
    bezeichnung: daten.bezeichnung,
    qualifikation: daten.qualifikation ?? null,
    dauerMin: daten.dauerMin ?? null,
    grundzeitMin: daten.grundzeitMin ?? null,
    aktiv: daten.aktiv,
  }
  if (vorhanden.docs.length > 0) {
    await payload.update({
      collection: 'leistungskatalog',
      id: vorhanden.docs[0].id,
      data,
      overrideAccess: true,
    })
  } else {
    await payload.create({ collection: 'leistungskatalog', data, overrideAccess: true })
  }
  if (typeof daten.preis === 'number') await setzePreis(payload, tenantId, code, daten.preis)

  return {
    code,
    bezeichnung: daten.bezeichnung,
    qualifikation: daten.qualifikation,
    dauerMin: daten.dauerMin,
    grundzeitMin: daten.grundzeitMin,
    preis: daten.preis,
    aktiv: daten.aktiv,
  }
}

// Löscht einen Katalog-Eintrag (der Preis in der Abrechnungskonfiguration bleibt).
export async function loescheLeistung(tenantId: string, code: string): Promise<boolean> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'leistungskatalog',
    where: { and: [{ tenantId: { equals: tenantId } }, { code: { equals: code } }] },
    limit: 1,
    overrideAccess: true,
  })
  if (res.docs.length === 0) return false
  await payload.delete({ collection: 'leistungskatalog', id: res.docs[0].id, overrideAccess: true })
  return true
}
