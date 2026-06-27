import type { Where } from 'payload'
import { payloadClient } from './payloadClient'
import { tourSchema, klientOperativSchema, type Tour, type KlientOperativ } from '@/shared/domain'

// Liest Touren eines Mandanten (Säule 2) und bildet sie auf die Domäne ab.
// overrideAccess: true — die v1-API läuft serverseitig vertrauenswürdig;
// die feingranulare RBAC greift an Payloads eigener REST/Admin-Schnittstelle.
export async function ladeTouren(tenantId: string, datum?: string): Promise<Tour[]> {
  const payload = await payloadClient()
  const where: Where = { tenantId: { equals: tenantId } }
  if (datum) where.datum = { equals: datum }
  const res = await payload.find({
    collection: 'touren',
    where,
    limit: 200,
    overrideAccess: true,
    depth: 0,
  })
  return res.docs.map((d) => tourSchema.parse(normTour(d)))
}

// Lädt alle Touren über Mandanten hinweg (für den marktplatzweiten Fan-out).
export async function ladeAlleTouren(): Promise<Tour[]> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'touren',
    limit: 500,
    overrideAccess: true,
    depth: 0,
  })
  return res.docs.map((d) => tourSchema.parse(normTour(d)))
}

export async function ladeTour(id: string): Promise<Tour | null> {
  const payload = await payloadClient()
  try {
    const d = await payload.findByID({ collection: 'touren', id, overrideAccess: true, depth: 0 })
    return tourSchema.parse(normTour(d))
  } catch {
    return null
  }
}

// Liest operative Klienten (Säule 2). Optional nach Status gefiltert.
export async function ladeKlientenOperativ(
  tenantId: string,
  status?: string,
): Promise<KlientOperativ[]> {
  const payload = await payloadClient()
  const where: Where = { tenantId: { equals: tenantId } }
  if (status) where.status = { equals: status }
  const res = await payload.find({
    collection: 'klienten_operativ',
    where,
    limit: 500,
    overrideAccess: true,
    depth: 0,
  })
  return res.docs.map((d) => klientOperativSchema.parse(normKlient(d)))
}

// Aktualisiert die Einsatzfolge einer Tour (z. B. nach Ein-Klick-Aufnahme).
export async function speichereEinsaetze(
  tourId: string,
  einsaetze: Tour['einsaetze'],
): Promise<Tour> {
  const payload = await payloadClient()
  const d = await payload.update({
    collection: 'touren',
    id: tourId,
    data: { einsaetze },
    overrideAccess: true,
    depth: 0,
  })
  return tourSchema.parse(normTour(d))
}

// ── Normalisierung Payload-Doc → Domäne ──────────────────────────────────
// Payload liefert id als string|number und JSON-Felder als unknown; wir
// reichen nur die Domänenfelder durch und lassen zod validieren.
function normTour(d: any): unknown {
  return {
    id: String(d.id),
    tenantId: d.tenantId,
    datum: d.datum,
    pflegekraftId: d.pflegekraftId,
    pflegekraftQualifikation: arr(d.pflegekraftQualifikation),
    start: d.start,
    startZeit: d.startZeit ?? 480,
    einsaetze: arr(d.einsaetze).map((e) => ({
      pseudonymId: e.pseudonymId,
      geo: e.geo,
      zeitfenster: e.zeitfenster,
      dauerMin: e.dauerMin ?? 30,
      qualifikation: arr(e.qualifikation),
      ankunft: e.ankunft,
      probe: Boolean(e.probe),
    })),
  }
}

function normKlient(d: any): unknown {
  return {
    pseudonymId: d.pseudonymId,
    tenantId: d.tenantId,
    geo: d.geo,
    pflegegrad: d.pflegegrad,
    leistungen: arr(d.leistungen),
    qualifikation: arr(d.qualifikation),
    zeitfenster: d.zeitfenster,
    dauerMin: d.dauerMin ?? 30,
    bezugspflege: d.bezugspflege,
    status: d.status ?? 'aktiv',
  }
}

// Hilfsfunktion: stellt sicher, dass JSON-Felder als Array vorliegen.
function arr(v: unknown): any[] {
  return Array.isArray(v) ? v : []
}
