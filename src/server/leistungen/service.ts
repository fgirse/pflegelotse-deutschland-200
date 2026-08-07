import { payloadClient } from '@/server/payloadClient'
import { LEISTUNGSKOMPLEXE } from '@/shared/leistungskomplexe'
import type { LeistungEintrag, LeistungSpeichern } from '@/shared/leistungskatalog'

type Payload = Awaited<ReturnType<typeof payloadClient>>

// GKV- und PKV-Preise des Mandanten aus der Abrechnungskonfiguration
// (Single Source der Preise).
async function ladePreise(
  payload: Payload,
  tenantId: string,
): Promise<{ preise: Record<string, number>; preisePrivat: Record<string, number> }> {
  const res = await payload.find({
    collection: 'abrechnungskonfiguration',
    where: { tenantId: { equals: tenantId } },
    limit: 1,
    overrideAccess: true,
  })
  const d = res.docs[0] as
    | { preise?: Record<string, number>; preisePrivat?: Record<string, number> }
    | undefined
  return {
    preise: d?.preise && typeof d.preise === 'object' ? d.preise : {},
    preisePrivat: d?.preisePrivat && typeof d.preisePrivat === 'object' ? d.preisePrivat : {},
  }
}

type KatalogDoc = {
  code?: string
  bezeichnung?: string
  qualifikation?: 'grundpflege' | 'behandlungspflege' | null
  dauerMin?: number | null
  grundzeitMin?: number | null
  aktiv?: boolean | null
}

function zuEintrag(
  d: KatalogDoc,
  preise: Record<string, number>,
  preisePrivat: Record<string, number>,
): LeistungEintrag {
  const code = d.code ?? ''
  return {
    code,
    bezeichnung: d.bezeichnung ?? '',
    qualifikation: d.qualifikation ?? undefined,
    dauerMin: typeof d.dauerMin === 'number' ? d.dauerMin : undefined,
    grundzeitMin: typeof d.grundzeitMin === 'number' ? d.grundzeitMin : undefined,
    preis: typeof preise[code] === 'number' ? preise[code] : undefined,
    preisPrivat: typeof preisePrivat[code] === 'number' ? preisePrivat[code] : undefined,
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
  const { preise, preisePrivat } = await ladePreise(payload, tenantId)
  return res.docs.map((d) => zuEintrag(d as KatalogDoc, preise, preisePrivat))
}

// Schreibt GKV- und/oder PKV-Preis in die Abrechnungskonfiguration (Upsert des
// Mandanten-Docs). Nur übergebene Werte werden gesetzt; undefined bleibt unberührt.
async function setzePreis(
  payload: Payload,
  tenantId: string,
  code: string,
  preis: number | undefined,
  preisPrivat: number | undefined,
): Promise<void> {
  if (preis === undefined && preisPrivat === undefined) return
  const res = await payload.find({
    collection: 'abrechnungskonfiguration',
    where: { tenantId: { equals: tenantId } },
    limit: 1,
    overrideAccess: true,
  })
  const doc = res.docs[0] as
    | { id: string | number; preise?: Record<string, number>; preisePrivat?: Record<string, number> }
    | undefined
  const merge = (
    vorhanden: Record<string, number> | undefined,
    wert: number | undefined,
  ): Record<string, number> | undefined => {
    if (wert === undefined) return vorhanden && typeof vorhanden === 'object' ? vorhanden : undefined
    return { ...(vorhanden && typeof vorhanden === 'object' ? vorhanden : {}), [code]: wert }
  }
  if (doc) {
    const data: { preise?: Record<string, number>; preisePrivat?: Record<string, number> } = {}
    if (preis !== undefined) data.preise = merge(doc.preise, preis)
    if (preisPrivat !== undefined) data.preisePrivat = merge(doc.preisePrivat, preisPrivat)
    await payload.update({ collection: 'abrechnungskonfiguration', id: doc.id, data, overrideAccess: true })
  } else {
    const data: { tenantId: string; preise?: Record<string, number>; preisePrivat?: Record<string, number> } = {
      tenantId,
    }
    if (preis !== undefined) data.preise = { [code]: preis }
    if (preisPrivat !== undefined) data.preisePrivat = { [code]: preisPrivat }
    await payload.create({ collection: 'abrechnungskonfiguration', data, overrideAccess: true })
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
  await setzePreis(payload, tenantId, code, daten.preis, daten.preisPrivat)

  return {
    code,
    bezeichnung: daten.bezeichnung,
    qualifikation: daten.qualifikation,
    dauerMin: daten.dauerMin,
    grundzeitMin: daten.grundzeitMin,
    preis: daten.preis,
    preisPrivat: daten.preisPrivat,
    aktiv: daten.aktiv,
  }
}

// Aktive Katalog-Einträge (Code + Bezeichnung) für Auswahllisten — ohne
// Vorbefüllung. Fehlt der Katalog, kommt eine leere Liste zurück.
export async function ladeKatalogAuswahl(
  tenantId: string,
): Promise<{ code: string; bezeichnung: string }[]> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'leistungskatalog',
    where: { and: [{ tenantId: { equals: tenantId } }, { aktiv: { not_equals: false } }] },
    limit: 500,
    sort: 'code',
    overrideAccess: true,
  })
  return (res.docs as KatalogDoc[])
    .filter((d) => d.code)
    .map((d) => ({ code: d.code as string, bezeichnung: d.bezeichnung ?? '' }))
}

// ── Konsum: Standardzeiten aus dem Katalog ableiten ───────────────────────

export interface KatalogZeit {
  dauerMin?: number
  grundzeitMin?: number
  qualifikation?: 'grundpflege' | 'behandlungspflege'
}

// Katalog als Map code → Zeiten/Qualifikation (nur aktive Einträge). Anders als
// ladeKatalog befüllt dieser Lookup NICHT vor — fehlt der Katalog, wird nichts
// abgeleitet (die Anlage nutzt dann ihre eigenen Werte).
export async function ladeKatalogMap(tenantId: string): Promise<Map<string, KatalogZeit>> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'leistungskatalog',
    where: { and: [{ tenantId: { equals: tenantId } }, { aktiv: { not_equals: false } }] },
    limit: 500,
    overrideAccess: true,
  })
  const map = new Map<string, KatalogZeit>()
  for (const d of res.docs as KatalogDoc[]) {
    if (!d.code) continue
    map.set(d.code, {
      dauerMin: typeof d.dauerMin === 'number' ? d.dauerMin : undefined,
      grundzeitMin: typeof d.grundzeitMin === 'number' ? d.grundzeitMin : undefined,
      qualifikation: d.qualifikation ?? undefined,
    })
  }
  return map
}

export interface AbgeleiteteZeiten {
  dauerMin?: number // Summe der Leistungszeiten
  grundzeitMin?: number // Grundzeit des Besuchs (einmal) = Maximum der Codes
  qualifikation: string[] // Vereinigung der geforderten Qualifikationen
}

// Reine Ableitung: aus einer Menge LK-Codes + Katalog die Standardwerte. dauerMin
// summiert (je Leistung), grundzeitMin als Maximum (Grundzeit fällt je Besuch
// einmal an), qualifikation als Vereinigung. Unbekannte Codes werden ignoriert.
export function standardzeitenAusKatalog(
  codes: string[],
  katalog: Map<string, KatalogZeit>,
): AbgeleiteteZeiten {
  let dauer = 0
  let hatDauer = false
  let grund = 0
  let hatGrund = false
  const quali = new Set<string>()
  for (const code of codes) {
    const e = katalog.get(code)
    if (!e) continue
    if (typeof e.dauerMin === 'number') {
      dauer += e.dauerMin
      hatDauer = true
    }
    if (typeof e.grundzeitMin === 'number') {
      grund = Math.max(grund, e.grundzeitMin)
      hatGrund = true
    }
    if (e.qualifikation) quali.add(e.qualifikation)
  }
  return {
    dauerMin: hatDauer ? dauer : undefined,
    grundzeitMin: hatGrund ? grund : undefined,
    qualifikation: [...quali],
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
