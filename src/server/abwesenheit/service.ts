import { payloadClient } from '@/server/payloadClient'
import type { AbwesenheitEingabe, AbwesenheitTyp, AbwesenheitZeile } from '@/shared/abwesenheit'

type AbwDoc = {
  id: string | number
  von?: string
  bis?: string
  typ?: AbwesenheitTyp | null
  notiz?: string | null
}

function zuZeile(d: AbwDoc): AbwesenheitZeile {
  return {
    id: String(d.id),
    von: d.von ?? '',
    bis: d.bis ?? '',
    typ: d.typ ?? 'sonstiges',
    notiz: d.notiz ?? undefined,
  }
}

// Abwesenheiten einer Pflegekraft (nach Beginn sortiert).
export async function listeAbwesenheiten(
  tenantId: string,
  pflegekraftId: string,
): Promise<AbwesenheitZeile[]> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'abwesenheiten',
    where: { and: [{ tenantId: { equals: tenantId } }, { pflegekraftId: { equals: pflegekraftId } }] },
    limit: 200,
    sort: 'von',
    overrideAccess: true,
  })
  return res.docs.map((d) => zuZeile(d as AbwDoc))
}

export async function erstelleAbwesenheit(
  tenantId: string,
  pflegekraftId: string,
  eingabe: AbwesenheitEingabe,
): Promise<AbwesenheitZeile> {
  const payload = await payloadClient()
  const doc = await payload.create({
    collection: 'abwesenheiten',
    data: {
      tenantId,
      pflegekraftId,
      von: eingabe.von,
      bis: eingabe.bis,
      typ: eingabe.typ,
      ...(eingabe.notiz ? { notiz: eingabe.notiz } : {}),
    },
    overrideAccess: true,
  })
  return zuZeile(doc as AbwDoc)
}

// Löscht eine Abwesenheit — nur wenn sie zum Mandanten UND zur Pflegekraft gehört.
export async function loescheAbwesenheit(
  tenantId: string,
  pflegekraftId: string,
  id: string,
): Promise<boolean> {
  const payload = await payloadClient()
  const doc = (await payload
    .findByID({ collection: 'abwesenheiten', id, overrideAccess: true })
    .catch(() => null)) as { tenantId?: string; pflegekraftId?: string } | null
  if (!doc || doc.tenantId !== tenantId || doc.pflegekraftId !== pflegekraftId) return false
  await payload.delete({ collection: 'abwesenheiten', id, overrideAccess: true })
  return true
}
