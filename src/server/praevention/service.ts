import type { Where } from 'payload'
import { payloadClient } from '@/server/payloadClient'
import { generiereEmpfehlungen, baueDokument } from './empfehlung'
import {
  praeventionSchema,
  type Praevention,
  type PraevErstellen,
  type Empfehlung,
} from '@/shared/praevention'

// Erstellt eine Präventionsempfehlung (Status entwurf). Sind keine Empfehlungen
// mitgegeben, werden sie aus der Erhebung generiert (/F920/) — die Pflegekraft
// kann sie anschließend bearbeiten (/F940/).
export async function erstellePraevention(
  tenantId: string,
  erstelltVon: string,
  input: PraevErstellen,
): Promise<Praevention> {
  const payload = await payloadClient()
  const empfehlungen: Empfehlung[] = input.empfehlungen ?? generiereEmpfehlungen(input.felder)
  const d = await payload.create({
    collection: 'praeventionsempfehlungen',
    data: {
      pseudonymId: input.pseudonymId,
      tenantId,
      status: 'entwurf',
      felder: input.felder,
      empfehlungen,
      freitext: input.freitext,
      erstelltVon,
    },
    overrideAccess: true,
  })
  return praeventionSchema.parse(norm(d))
}

export async function ladePraevention(id: string, tenantId: string): Promise<Praevention | null> {
  const payload = await payloadClient()
  try {
    const d = await payload.findByID({
      collection: 'praeventionsempfehlungen',
      id,
      overrideAccess: true,
      depth: 0,
    })
    const p = praeventionSchema.parse(norm(d))
    return p.tenantId === tenantId ? p : null
  } catch {
    return null
  }
}

export async function listePraevention(
  tenantId: string,
  pseudonymId?: string,
): Promise<Praevention[]> {
  const payload = await payloadClient()
  const where: Where = { tenantId: { equals: tenantId } }
  if (pseudonymId) where.pseudonymId = { equals: pseudonymId }
  const res = await payload.find({
    collection: 'praeventionsempfehlungen',
    where,
    limit: 200,
    overrideAccess: true,
    depth: 0,
  })
  return res.docs.map((d) => praeventionSchema.parse(norm(d)))
}

// Aktualisiert eine Empfehlung im Entwurf (Felder, Empfehlungen, Freitext).
export async function aktualisierePraevention(
  id: string,
  tenantId: string,
  input: PraevErstellen,
): Promise<Praevention | null> {
  const vorhanden = await ladePraevention(id, tenantId)
  if (!vorhanden) return null
  if (vorhanden.status === 'finalisiert') throw new Error('Bereits finalisiert')
  const payload = await payloadClient()
  const d = await payload.update({
    collection: 'praeventionsempfehlungen',
    id,
    data: {
      felder: input.felder,
      empfehlungen: input.empfehlungen ?? generiereEmpfehlungen(input.felder),
      freitext: input.freitext,
    },
    overrideAccess: true,
  })
  return praeventionSchema.parse(norm(d))
}

// Finalisiert (fachliche Entscheidung der Pflegekraft, /F940/).
export async function finalisierePraevention(
  id: string,
  tenantId: string,
): Promise<Praevention | null> {
  const vorhanden = await ladePraevention(id, tenantId)
  if (!vorhanden) return null
  const payload = await payloadClient()
  const d = await payload.update({
    collection: 'praeventionsempfehlungen',
    id,
    data: { status: 'finalisiert' },
    overrideAccess: true,
  })
  return praeventionSchema.parse(norm(d))
}

// Exportierbares Dokument (Markdown) für die Pflegekasse (/F930/).
export async function exportiereDokument(
  id: string,
  tenantId: string,
  datum: string,
): Promise<string | null> {
  const p = await ladePraevention(id, tenantId)
  if (!p) return null
  return baueDokument({
    pseudonymId: p.pseudonymId,
    status: p.status,
    felder: p.felder,
    empfehlungen: p.empfehlungen,
    freitext: p.freitext,
    erstelltVon: p.erstelltVon,
    datum,
  })
}

function norm(d: any) {
  return {
    id: String(d.id),
    pseudonymId: d.pseudonymId,
    tenantId: d.tenantId,
    status: d.status ?? 'entwurf',
    felder: Array.isArray(d.felder) ? d.felder : [],
    empfehlungen: Array.isArray(d.empfehlungen) ? d.empfehlungen : [],
    freitext: d.freitext ?? undefined,
    erstelltVon: d.erstelltVon ?? undefined,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
  }
}
