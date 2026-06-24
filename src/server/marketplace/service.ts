import { payloadClient } from '@/server/payloadClient'
import { neuePseudonymId } from '@/lib/pseudonym'
import { identityHash } from '@/lib/audit'
import { berechneFitScore } from '@/server/matching/service'
import { berechneDeadline } from '@/server/sla/deadline'
import { getNotifier } from '@/server/notify/Notifier'
import { erfasseVermittlungsgebuehr } from '@/server/billing/service'
import { ladeAlleTouren } from '@/server/repo'
import { minToHHMM } from '@/shared/time'
import { bedarfSchema, type Bedarf, type BedarfErstellen, type Kontakt } from '@/shared/marketplace'
import type { Tour } from '@/shared/domain'

// ── Marktplatz / Reverse Bidding ─────────────────────────────────────────
// Kapselt die Geschäftslogik: Bedarf einstellen (Säulen-Split), Fan-out an
// passende Dienste, Angebote, Auswahl und die leck-sichere Kontaktfreigabe.

const OFFEN = ['offen', 'in_bearbeitung'] as const

// Stellt einen Bedarf ein: PII → Säule 1 (verschlüsselt), operativ → Säule 2,
// Fan-out an alle passenden Dienste. Gibt die Bedarfs-ID + Treffer-Mandanten zurück.
export async function erstelleBedarf(
  input: BedarfErstellen,
): Promise<{ bedarfId: string; matchingTenants: string[] }> {
  const payload = await payloadClient()
  const pseudonymId = neuePseudonymId()

  // Passende Dienste über den Fit-Score bestimmen (vor dem Schreiben).
  const matchingTenants = await findePassendeDienste({
    geo: input.geo,
    zeitfenster: input.zeitfenster,
    dauerMin: input.dauerMin,
    qualifikation: input.qualifikation,
  })

  // Säule 1: Kontaktdaten (Hooks verschlüsseln).
  await payload.create({
    collection: 'angehoerige_identitaet',
    data: { pseudonymId, ...input.kontakt },
    overrideAccess: true,
  })

  // Frist der verbindlichen Rückmeldung (/F430/), Express kürzer (/F350/).
  const deadlineAt = berechneDeadline(Date.now(), input.express)

  // Säule 2: operativer, pseudonymer Bedarf.
  await payload.create({
    collection: 'bedarfe',
    data: {
      pseudonymId,
      geo: input.geo,
      pflegegrad: input.pflegegrad,
      leistungen: input.leistungen,
      qualifikation: input.qualifikation,
      zeitfenster: input.zeitfenster,
      dauerMin: input.dauerMin,
      express: input.express,
      status: 'offen',
      matchingTenants,
      deadlineAt,
    },
    overrideAccess: true,
  })

  // Fan-out an passende Dienste (/F420/) — anonym, ohne PII.
  await benachrichtigeDienste(matchingTenants, pseudonymId, input)

  return { bedarfId: pseudonymId, matchingTenants }
}

// Benachrichtigt die Disponenten/Inhaber der passenden Mandanten über einen
// neuen, zu ihren Touren passenden Bedarf. Inhalt ist anonym (keine PII).
async function benachrichtigeDienste(
  tenantIds: string[],
  bedarfId: string,
  bedarf: BedarfErstellen,
): Promise<void> {
  if (tenantIds.length === 0) return
  const payload = await payloadClient()
  const notifier = getNotifier()

  const res = await payload.find({
    collection: 'users',
    where: {
      and: [
        { tenantId: { in: tenantIds } },
        { role: { in: ['disponent', 'admin'] } },
      ],
    },
    limit: 200,
    overrideAccess: true,
    depth: 0,
  })

  const fenster = `${minToHHMM(bedarf.zeitfenster.von)}–${minToHHMM(bedarf.zeitfenster.bis)}`
  const betreff = bedarf.express
    ? 'Express: Neuer passender Pflegebedarf'
    : 'Neuer passender Pflegebedarf'
  const html =
    `<p>Ein neuer Bedarf passt zu Ihren Touren.</p>` +
    `<ul><li>Pflegegrad: ${bedarf.pflegegrad ?? '–'}</li>` +
    `<li>Qualifikation: ${bedarf.qualifikation.join(', ') || '—'}</li>` +
    `<li>Zeitfenster: ${fenster}</li></ul>` +
    `<p>Bitte im Dienst-Bereich „Eingehende Bedarfe" ein Angebot abgeben.</p>`

  await Promise.all(
    res.docs
      .map((u) => (u as { email?: string }).email)
      .filter((mail): mail is string => Boolean(mail))
      .map((mail) =>
        notifier
          .sende(mail, betreff, html, `${bedarfId}:${mail}:new`)
          .catch((e) => console.error('Benachrichtigung fehlgeschlagen:', e)),
      ),
  )
}

// Fan-out-Kern: bewertet den Bedarf gegen die Touren JEDES Mandanten und gibt
// die Mandanten zurück, bei denen mindestens eine Tour machbar passt (/F250/).
export async function findePassendeDienste(kandidat: {
  geo: Bedarf['geo']
  zeitfenster: Bedarf['zeitfenster']
  dauerMin: number
  qualifikation: string[]
}): Promise<string[]> {
  const touren = await ladeAlleTouren()

  // Touren nach Mandant gruppieren.
  const proTenant = new Map<string, Tour[]>()
  for (const t of touren) {
    const liste = proTenant.get(t.tenantId) ?? []
    liste.push(t)
    proTenant.set(t.tenantId, liste)
  }

  const treffer: string[] = []
  for (const [tenantId, tenantTouren] of proTenant) {
    const { matches } = await berechneFitScore(tenantTouren, kandidat)
    if (matches.length > 0) treffer.push(tenantId)
  }
  return treffer
}

// Listet für einen Dienst die passenden, noch offenen Bedarfe — ANONYM
// (nur Säule-2-Felder, keine PII).
export async function listeBedarfeFuerDienst(tenantId: string): Promise<Bedarf[]> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'bedarfe',
    where: { status: { in: ['offen', 'in_bearbeitung'] } },
    limit: 200,
    overrideAccess: true,
    depth: 0,
  })
  return res.docs
    .map((d) => bedarfSchema.parse(bedarfAusDoc(d)))
    .filter((b) => b.matchingTenants.includes(tenantId))
}

// Bedarfe, die diesem Dienst zugeschlagen wurden (Status vergeben). Für die
// Dienst-UI, um den freigegebenen Kontakt abzurufen.
export async function listeVergebenFuerDienst(tenantId: string): Promise<Bedarf[]> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'bedarfe',
    where: {
      and: [{ status: { equals: 'vergeben' } }, { selectedTenantId: { equals: tenantId } }],
    },
    limit: 100,
    overrideAccess: true,
    depth: 0,
  })
  return res.docs.map((d) => bedarfSchema.parse(bedarfAusDoc(d)))
}

// Ein Dienst gibt ein verbindliches Angebot ab. Setzt den Bedarf auf
// „in_bearbeitung" (Statusmarker /F320/). Doppelangebote verhindert der
// eindeutige Index (bedarfPseudonymId+tenantId).
export async function gibAngebotAb(
  bedarfId: string,
  tenantId: string,
  nachricht: string,
  mehrwegMin?: number,
) {
  const payload = await payloadClient()
  const bedarf = await ladeBedarf(bedarfId)
  if (!bedarf) throw new Error('Bedarf nicht gefunden')
  if (!OFFEN.includes(bedarf.status as (typeof OFFEN)[number])) {
    throw new Error(`Bedarf ist nicht mehr offen (Status: ${bedarf.status})`)
  }
  if (!bedarf.matchingTenants.includes(tenantId)) {
    throw new Error('Dienst gehört nicht zu den passenden Diensten dieses Bedarfs')
  }

  const angebot = await payload.create({
    collection: 'angebote',
    data: {
      bedarfPseudonymId: bedarfId,
      tenantId,
      nachricht,
      mehrwegMin,
      status: 'abgegeben',
      createdAt: new Date().toISOString(),
    },
    overrideAccess: true,
  })

  // Bedarf auf in_bearbeitung heben und die erste Reaktion festhalten (SLA).
  if (bedarf.status === 'offen' || !bedarf.firstResponseAt) {
    await payload.update({
      collection: 'bedarfe',
      where: { pseudonymId: { equals: bedarfId } },
      data: {
        status: 'in_bearbeitung',
        ...(bedarf.firstResponseAt ? {} : { firstResponseAt: new Date().toISOString() }),
      },
      overrideAccess: true,
    })
  }
  return angebot
}

// Angebote zu einem Bedarf (für die Angehörigen-Vergleichsansicht).
export async function listeAngebote(bedarfId: string) {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'angebote',
    where: {
      and: [{ bedarfPseudonymId: { equals: bedarfId } }, { status: { equals: 'abgegeben' } }],
    },
    limit: 100,
    overrideAccess: true,
    depth: 0,
  })
  return res.docs
}

// Angehörige wählt einen Dienst: Bedarf → vergeben, selectedTenantId gesetzt.
// Genau das gibt anschließend die Kontaktdaten frei (/F340/). Ein Audit-Eintrag
// dokumentiert die Freigabe (ohne Klarnamen).
export async function waehleDienst(bedarfId: string, tenantId: string): Promise<void> {
  const payload = await payloadClient()
  const bedarf = await ladeBedarf(bedarfId)
  if (!bedarf) throw new Error('Bedarf nicht gefunden')
  if (bedarf.status === 'vergeben') throw new Error('Bedarf ist bereits vergeben')

  // Es muss ein Angebot dieses Dienstes geben.
  const angebote = await listeAngebote(bedarfId)
  if (!angebote.some((a) => a.tenantId === tenantId)) {
    throw new Error('Dieser Dienst hat kein Angebot abgegeben')
  }

  await payload.update({
    collection: 'bedarfe',
    where: { pseudonymId: { equals: bedarfId } },
    data: { status: 'vergeben', selectedTenantId: tenantId },
    overrideAccess: true,
  })

  const { hash, pepperVersion } = identityHash(`${bedarfId}:${tenantId}`)
  await payload.create({
    collection: 'gdpr_audit_log',
    data: {
      timestamp: new Date().toISOString(),
      request_type: 'CONTACT_RELEASE',
      identity_hash: hash,
      pepper_version: pepperVersion,
      former_pseudonym_id: bedarfId,
      status: 'SUCCESS',
    },
    overrideAccess: true,
  })

  // Vermittlungsgebühr leck-sicher an die Kontaktfreigabe koppeln (/F1040/).
  await erfasseVermittlungsgebuehr(tenantId, bedarfId)
}

// Gibt die Kontaktdaten NUR an den gewählten Dienst zurück. Anti-Leakage-
// Kernpunkt (/F340/, P6): vor der Auswahl bzw. an andere Dienste → null.
export async function holeKontakt(
  bedarfId: string,
  tenantId: string,
): Promise<Kontakt | null> {
  const bedarf = await ladeBedarf(bedarfId)
  if (!bedarf) return null
  if (bedarf.status !== 'vergeben' || bedarf.selectedTenantId !== tenantId) {
    return null // Freigabe nicht erfolgt oder falscher Dienst
  }
  return holeKontaktIntern(bedarfId)
}

// Liest die Kontaktdaten OHNE Freigabe-Gate. Ausschließlich serverseitig
// nutzen (z. B. Absage-E-Mail an die Angehörige selbst) — niemals über die
// API einem Dienst zugänglich machen.
export async function holeKontaktIntern(bedarfId: string): Promise<Kontakt | null> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'angehoerige_identitaet',
    where: { pseudonymId: { equals: bedarfId } },
    limit: 1,
    overrideAccess: true, // Lesen ist sonst komplett gesperrt
    depth: 0,
  })
  const doc = res.docs[0]
  if (!doc) return null
  return {
    vorname: doc.vorname ?? '',
    nachname: doc.nachname ?? '',
    telefon: doc.telefon ?? '',
    email: doc.email ?? '',
    adresse: doc.adresse ?? undefined,
  }
}

// ── intern ────────────────────────────────────────────────────────────────
export async function ladeBedarf(bedarfId: string): Promise<Bedarf | null> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'bedarfe',
    where: { pseudonymId: { equals: bedarfId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  if (!res.docs[0]) return null
  return bedarfSchema.parse(bedarfAusDoc(res.docs[0]))
}

export function bedarfAusDoc(d: any): unknown {
  return {
    pseudonymId: d.pseudonymId,
    geo: d.geo,
    pflegegrad: d.pflegegrad ?? undefined,
    leistungen: Array.isArray(d.leistungen) ? d.leistungen : [],
    qualifikation: Array.isArray(d.qualifikation) ? d.qualifikation : [],
    zeitfenster: d.zeitfenster,
    dauerMin: d.dauerMin ?? 30,
    express: Boolean(d.express),
    status: d.status ?? 'offen',
    matchingTenants: Array.isArray(d.matchingTenants) ? d.matchingTenants : [],
    selectedTenantId: d.selectedTenantId ?? undefined,
    deadlineAt: d.deadlineAt ? new Date(d.deadlineAt).toISOString() : undefined,
    firstResponseAt: d.firstResponseAt ? new Date(d.firstResponseAt).toISOString() : undefined,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
  }
}
