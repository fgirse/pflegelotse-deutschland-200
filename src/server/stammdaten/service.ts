import { payloadClient } from '@/server/payloadClient'
import type { PflegekraftStammDaten } from '@/shared/pflegekraftStamm'

type StammDoc = {
  id: string | number
  pflegekraftId?: string
  qualifikation?: unknown
  geschlecht?: 'm' | 'w' | 'd' | null
  standardStartzeit?: number | null
  standardEndzeit?: number | null
  maxEinsaetze?: number | null
  wochentage?: unknown
}

// Payload-Dokument → schlanke Stammdaten (ohne id/tenantId).
function normalisiere(d: StammDoc): PflegekraftStammDaten {
  const zahl = (v: unknown) => (typeof v === 'number' ? v : undefined)
  return {
    qualifikation: Array.isArray(d.qualifikation)
      ? (d.qualifikation.filter((q) => q === 'grundpflege' || q === 'behandlungspflege') as (
          | 'grundpflege'
          | 'behandlungspflege'
        )[])
      : [],
    geschlecht: d.geschlecht ?? undefined,
    standardStartzeit: zahl(d.standardStartzeit),
    standardEndzeit: zahl(d.standardEndzeit),
    maxEinsaetze: zahl(d.maxEinsaetze),
    wochentage: Array.isArray(d.wochentage)
      ? (d.wochentage.filter((n) => typeof n === 'number') as number[])
      : [],
  }
}

// Alle Stammprofile eines Mandanten als Map pflegekraftId → Daten (für die
// Vorbelegung der Editoren in der Team-Verwaltung).
export async function ladeAllePflegekraftStamm(
  tenantId: string,
): Promise<Record<string, PflegekraftStammDaten>> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'pflegekraft_stamm',
    where: { tenantId: { equals: tenantId } },
    limit: 500,
    overrideAccess: true,
  })
  const map: Record<string, PflegekraftStammDaten> = {}
  for (const d of res.docs as StammDoc[]) {
    if (d.pflegekraftId) map[d.pflegekraftId] = normalisiere(d)
  }
  return map
}

// Legt das Stammprofil an oder aktualisiert es (Upsert je tenantId+pflegekraftId).
export async function speicherePflegekraftStamm(
  tenantId: string,
  pflegekraftId: string,
  daten: PflegekraftStammDaten,
): Promise<void> {
  const payload = await payloadClient()
  const vorhanden = await payload.find({
    collection: 'pflegekraft_stamm',
    where: {
      and: [{ tenantId: { equals: tenantId } }, { pflegekraftId: { equals: pflegekraftId } }],
    },
    limit: 1,
    overrideAccess: true,
  })
  const data = { tenantId, pflegekraftId, ...daten }
  if (vorhanden.docs.length > 0) {
    await payload.update({
      collection: 'pflegekraft_stamm',
      id: vorhanden.docs[0].id,
      data,
      overrideAccess: true,
    })
  } else {
    await payload.create({ collection: 'pflegekraft_stamm', data, overrideAccess: true })
  }
}
