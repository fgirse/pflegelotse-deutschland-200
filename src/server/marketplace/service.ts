import { payloadClient } from '@/server/payloadClient'
import { neuePseudonymId } from '@/lib/pseudonym'
import { identityHash } from '@/lib/audit'
import { berechneFitScore, planeTour } from '@/server/matching/service'
import { berechneDeadline } from '@/server/sla/deadline'
import { getNotifier } from '@/server/notify/Notifier'
import { erfasseVermittlungsgebuehr } from '@/server/billing/service'
import { ladeAlleTouren, ladeTour, speichereEinsaetze } from '@/server/repo'
import { minToHHMM } from '@/shared/time'
import { haversineKm } from '@/shared/orte'
import { EINWILLIGUNG_VERSION } from '@/shared/consent'
import { istGueltigeKasse } from '@/shared/krankenkassen'
import { env } from '@/lib/env'
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
  // Optionale Konto-Verknüpfung (gesetzt, wenn ein Suchender eingeloggt ist).
  ownerUserId?: string,
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

  // Säule 1: Kontaktdaten (Hooks verschlüsseln) + Konto-Verknüpfung +
  // Einwilligungs-Nachweis (Zeitpunkt + Fassung, serverseitig gesetzt).
  // Nur die bekannten PII-Felder übernehmen — neue Kontaktfelder (Beratungs-
  // stelle, Kontaktpräferenz) werden erst in einer späteren Phase persistiert.
  await payload.create({
    collection: 'angehoerige_identitaet',
    data: {
      pseudonymId,
      ownerUserId,
      einwilligungAt: new Date().toISOString(),
      einwilligungVersion: EINWILLIGUNG_VERSION,
      vorname: input.kontakt.vorname,
      nachname: input.kontakt.nachname,
      telefon: input.kontakt.telefon ?? '',
      email: input.kontakt.email,
      adresse: input.kontakt.adresse ?? '',
    },
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
      // Kasse nur übernehmen, wenn sie zur Art passt — sonst nur die Art.
      kostentraegerArt: input.kostentraegerArt,
      krankenversicherer:
        input.kostentraegerArt &&
        input.krankenversicherer &&
        istGueltigeKasse(input.kostentraegerArt, input.krankenversicherer)
          ? input.krankenversicherer
          : undefined,
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
  // Zusätzlich Dienste, deren Einzugsgebiet die Koordinate abdeckt (auch ohne
  // passende Tour) — so erreichen Bedarfe auch neu onboardende Dienste.
  const ausGebiet = await diensteImEinzugsgebiet(kandidat.geo)
  return Array.from(new Set([...treffer, ...ausGebiet]))
}

// Lädt die Einzugsgebiete je Mandant aus den Dienst-Nutzern (Standort + Radius).
async function ladeEinzugsgebiete(): Promise<
  Map<string, { geo: { lat: number; lng: number }; radiusKm: number }>
> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'users',
    where: { role: { in: ['admin', 'disponent', 'pflegekraft'] } },
    limit: 500,
    overrideAccess: true,
    depth: 0,
  })
  const map = new Map<string, { geo: { lat: number; lng: number }; radiusKm: number }>()
  for (const u of res.docs as {
    tenantId?: string
    einzugsGeo?: { lat?: number; lng?: number }
    einzugsRadiusKm?: number
  }[]) {
    const lat = u.einzugsGeo?.lat
    const lng = u.einzugsGeo?.lng
    if (u.tenantId && typeof lat === 'number' && typeof lng === 'number' && !map.has(u.tenantId)) {
      map.set(u.tenantId, {
        geo: { lat, lng },
        radiusKm: typeof u.einzugsRadiusKm === 'number' ? u.einzugsRadiusKm : 15,
      })
    }
  }
  return map
}

// Mandanten, deren Einzugsgebiet die gegebene Koordinate abdeckt.
async function diensteImEinzugsgebiet(geo: { lat: number; lng: number }): Promise<string[]> {
  const gebiete = await ladeEinzugsgebiete()
  const treffer: string[] = []
  for (const [tenantId, g] of gebiete) {
    if (haversineKm(geo, g.geo) <= g.radiusKm) treffer.push(tenantId)
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
  // Einzugsgebiet dieses Dienstes — damit auch BEREITS offene Bedarfe sichtbar
  // werden, sobald der Dienst sein Gebiet setzt (nicht nur neue).
  const gebiet = (await ladeEinzugsgebiete()).get(tenantId)
  return res.docs
    .map((d) => bedarfSchema.parse(bedarfAusDoc(d)))
    .filter(
      (b) =>
        b.matchingTenants.includes(tenantId) ||
        (gebiet ? haversineKm(b.geo, gebiet.geo) <= gebiet.radiusKm : false),
    )
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

// Übernimmt einen GEWONNENEN Bedarf als Klient in die Tourenplanung des
// Dienstes: legt Säule 2 (operativ) + Säule 1 (Identität aus dem freigegebenen
// Kontakt) an. Idempotent über uebernommenAt. Nur erlaubt, wenn der Dienst den
// Bedarf gewonnen hat (Kontakt ist dann freigegeben — kein Leak).
export async function uebernehmeBedarfAlsKlient(
  bedarfId: string,
  tenantId: string,
): Promise<{ klientPseudonymId: string; bereits: boolean }> {
  const payload = await payloadClient()
  const bedarf = await ladeBedarf(bedarfId)
  if (!bedarf) throw new Error('Bedarf nicht gefunden')
  if (bedarf.status !== 'vergeben' || bedarf.selectedTenantId !== tenantId) {
    throw new Error('Nur ein gewonnener Bedarf kann übernommen werden')
  }
  if (bedarf.uebernommenAt) {
    return { klientPseudonymId: '', bereits: true }
  }

  const kontakt = await holeKontaktIntern(bedarfId)
  const pseudonymId = neuePseudonymId()

  // Säule 2: operativer Klient (pseudonym).
  await payload.create({
    collection: 'klienten_operativ',
    data: {
      pseudonymId,
      tenantId,
      geo: bedarf.geo,
      pflegegrad: bedarf.pflegegrad,
      leistungen: bedarf.leistungen,
      qualifikation: bedarf.qualifikation,
      zeitfenster: bedarf.zeitfenster,
      dauerMin: bedarf.dauerMin,
      // Kostenträger aus dem gewonnenen Bedarf mitführen (Abrechnung).
      kostentraegerArt: bedarf.kostentraegerArt,
      krankenversicherer: bedarf.krankenversicherer,
      status: 'aktiv',
    },
    overrideAccess: true,
  })

  // Säule 1: Identität aus dem freigegebenen Kontakt (Hooks verschlüsseln).
  if (kontakt) {
    await payload.create({
      collection: 'klienten_identitaet',
      data: {
        pseudonymId,
        tenantId,
        externalId: `bedarf:${bedarfId}`,
        vorname: kontakt.vorname,
        nachname: kontakt.nachname,
        adresse: kontakt.adresse ?? '',
        telefon: kontakt.telefon,
        email: kontakt.email,
      },
      overrideAccess: true,
    })
  }

  // Bedarf als übernommen markieren (verhindert Doppel-Übernahme).
  await payload.update({
    collection: 'bedarfe',
    where: { pseudonymId: { equals: bedarfId } },
    data: { uebernommenAt: new Date().toISOString() },
    overrideAccess: true,
  })

  // Eine bestehende Probe-Einplanung dieses Bedarfs wird zum verbindlichen
  // Einsatz (neue Klienten-Kennung, Probe-Markierung entfernt).
  await wandleProbeInVerbindlich(bedarfId, tenantId, pseudonymId)

  return { klientPseudonymId: pseudonymId, bereits: false }
}

// Entfernt Probe-Einplanungen eines Bedarfs aus den Touren — für verlorene oder
// abgesagte Bedarfe. Optional ein Mandant ausgenommen (der Gewinner behält
// seine Probe, bis er übernimmt). Liefert die Anzahl entfernter Einsätze.
export async function entferneProbeEinsaetze(
  bedarfId: string,
  exceptTenantId?: string,
): Promise<number> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'touren',
    where: { 'einsaetze.pseudonymId': { equals: bedarfId } },
    limit: 500,
    overrideAccess: true,
    depth: 0,
  })
  let entfernt = 0
  for (const d of res.docs as { id: string | number; tenantId?: string }[]) {
    if (exceptTenantId && d.tenantId === exceptTenantId) continue
    const tour = await ladeTour(String(d.id))
    if (!tour) continue
    const gefiltert = tour.einsaetze.filter((e) => !(e.pseudonymId === bedarfId && e.probe))
    if (gefiltert.length !== tour.einsaetze.length) {
      // Tour ohne die Probe neu durchplanen (frische Ankunftszeiten) + speichern.
      const geplant = await planeTour({ ...tour, einsaetze: gefiltert })
      await speichereEinsaetze(tour.id, geplant.einsaetze)
      entfernt += tour.einsaetze.length - gefiltert.length
    }
  }
  return entfernt
}

// Wandelt die Probe-Einplanung eines übernommenen Bedarfs in einen
// verbindlichen Einsatz um (neue Klienten-Kennung, probe entfernt).
async function wandleProbeInVerbindlich(
  bedarfId: string,
  tenantId: string,
  neuePseudonym: string,
): Promise<void> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'touren',
    where: {
      and: [{ tenantId: { equals: tenantId } }, { 'einsaetze.pseudonymId': { equals: bedarfId } }],
    },
    limit: 50,
    overrideAccess: true,
    depth: 0,
  })
  for (const d of res.docs as { id: string | number }[]) {
    const tour = await ladeTour(String(d.id))
    if (!tour) continue
    let changed = false
    const neu = tour.einsaetze.map((e) => {
      if (e.pseudonymId === bedarfId && e.probe) {
        changed = true
        return { ...e, pseudonymId: neuePseudonym, probe: false }
      }
      return e
    })
    if (changed) {
      // Mit verbindlichem Einsatz neu durchplanen (frische Ankunftszeiten).
      const geplant = await planeTour({ ...tour, einsaetze: neu })
      await speichereEinsaetze(tour.id, geplant.einsaetze)
    }
  }
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
  // Passend, wenn der Dienst beim Fan-out getroffen wurde ODER der Bedarf im
  // Einzugsgebiet liegt (gleiche Logik wie listeBedarfeFuerDienst — sonst sieht
  // ein area-gematchter Dienst den Bedarf, kann aber kein Angebot abgeben).
  const gebiet = (await ladeEinzugsgebiete()).get(tenantId)
  const passt =
    bedarf.matchingTenants.includes(tenantId) ||
    (gebiet ? haversineKm(bedarf.geo, gebiet.geo) <= gebiet.radiusKm : false)
  if (!passt) {
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

  // Suchende benachrichtigen (an die eigene Adresse — kein Leak; Dienst bleibt
  // anonym, die Auswahl trifft die/der Suchende im Portal).
  await benachrichtigeSuchende(bedarfId, tenantId).catch((e) =>
    console.error('Angebots-Benachrichtigung fehlgeschlagen:', e),
  )

  return angebot
}

// E-Mail an die/den Suchenden, dass ein neues Angebot vorliegt. Dedupe je
// Dienst, damit pro Angebot höchstens eine Benachrichtigung rausgeht.
async function benachrichtigeSuchende(bedarfId: string, tenantId: string): Promise<void> {
  const kontakt = await holeKontaktIntern(bedarfId)
  if (!kontakt?.email) return
  const url = env.NEXT_PUBLIC_SERVER_URL
  const link = url.startsWith('https')
    ? `<p><a href="${url}/de/meine-bedarfe">Meine Bedarfe öffnen</a></p>`
    : ''
  await getNotifier().sende(
    kontakt.email,
    'Neues Angebot zu Ihrem Pflegebedarf',
    `<p>Hallo ${kontakt.vorname},</p>` +
      `<p>zu Ihrem Pflegebedarf ist ein neues Angebot eingegangen. Melden Sie sich an und ` +
      `vergleichen Sie unter „Meine Bedarfe" die Angebote — Sie wählen selbst, welcher ` +
      `Dienst Ihre Kontaktdaten erhält.</p>` +
      link,
    `${bedarfId}:angebot:${tenantId}`,
  )
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

  // Verlierer-Dienste: Probe-Einplanungen dieses Bedarfs entfernen. Der
  // Gewinner behält seine Probe (wird beim Übernehmen verbindlich).
  await entferneProbeEinsaetze(bedarfId, tenantId)

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

// „Meine Bedarfe": alle Bedarfe eines Suchenden-Kontos mit Angebots-Anzahl.
// Verknüpfung läuft über Säule 1 (ownerUserId) → pseudonymIds → Säule 2.
export async function listeBedarfeFuerNutzer(
  ownerUserId: string,
): Promise<{ bedarf: Bedarf; anzahlAngebote: number }[]> {
  const payload = await payloadClient()
  const ident = await payload.find({
    collection: 'angehoerige_identitaet',
    where: { ownerUserId: { equals: ownerUserId } },
    limit: 100,
    overrideAccess: true,
    depth: 0,
  })
  const ids = ident.docs
    .map((d) => (d as { pseudonymId?: string }).pseudonymId)
    .filter((x): x is string => Boolean(x))
  if (ids.length === 0) return []

  const res = await payload.find({
    collection: 'bedarfe',
    where: { pseudonymId: { in: ids } },
    limit: 100,
    overrideAccess: true,
    depth: 0,
    sort: '-createdAt',
  })

  // Abgegebene Angebote je Bedarf in einem Query zählen.
  const ang = await payload.find({
    collection: 'angebote',
    where: { and: [{ bedarfPseudonymId: { in: ids } }, { status: { equals: 'abgegeben' } }] },
    limit: 1000,
    overrideAccess: true,
    depth: 0,
  })
  const counts = new Map<string, number>()
  for (const a of ang.docs as { bedarfPseudonymId?: string }[]) {
    if (a.bedarfPseudonymId) counts.set(a.bedarfPseudonymId, (counts.get(a.bedarfPseudonymId) ?? 0) + 1)
  }

  return res.docs.map((d) => ({
    bedarf: bedarfSchema.parse(bedarfAusDoc(d)),
    anzahlAngebote: counts.get((d as { pseudonymId: string }).pseudonymId) ?? 0,
  }))
}

// Anzahl eigener, noch offener Bedarfe mit mindestens einem Angebot — für ein
// In-App-Badge „du hast Angebote".
export async function zaehleOffeneAngebote(userId: string): Promise<number> {
  const payload = await payloadClient()
  const ident = await payload.find({
    collection: 'angehoerige_identitaet',
    where: { ownerUserId: { equals: userId } },
    limit: 200,
    overrideAccess: true,
    depth: 0,
  })
  const ids = (ident.docs as { pseudonymId?: string }[])
    .map((d) => d.pseudonymId)
    .filter((x): x is string => Boolean(x))
  if (ids.length === 0) return 0

  const bedarfe = await payload.find({
    collection: 'bedarfe',
    where: { and: [{ pseudonymId: { in: ids } }, { status: { in: ['offen', 'in_bearbeitung'] } }] },
    limit: 200,
    overrideAccess: true,
    depth: 0,
  })
  const offeneIds = (bedarfe.docs as { pseudonymId?: string }[])
    .map((d) => d.pseudonymId)
    .filter((x): x is string => Boolean(x))
  if (offeneIds.length === 0) return 0

  const ang = await payload.find({
    collection: 'angebote',
    where: { and: [{ bedarfPseudonymId: { in: offeneIds } }, { status: { equals: 'abgegeben' } }] },
    limit: 1000,
    overrideAccess: true,
    depth: 0,
  })
  const mitAngebot = new Set(
    (ang.docs as { bedarfPseudonymId?: string }[]).map((a) => a.bedarfPseudonymId).filter(Boolean),
  )
  return mitAngebot.size
}

// Gehört ein Bedarf dem angemeldeten Suchenden? (Besitz über Säule 1.)
export async function bedarfGehoertNutzer(bedarfId: string, userId: string): Promise<boolean> {
  const payload = await payloadClient()
  const ident = await payload.find({
    collection: 'angehoerige_identitaet',
    where: { pseudonymId: { equals: bedarfId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  return (ident.docs[0] as { ownerUserId?: string } | undefined)?.ownerUserId === userId
}

// Suchende zieht einen eigenen, noch offenen Bedarf zurück (Status „abgesagt").
// Besitzprüfung über ownerUserId (Säule 1); räumt Probe-Einplanungen auf.
export async function zieheZurueck(bedarfId: string, userId: string): Promise<void> {
  const payload = await payloadClient()
  const ident = await payload.find({
    collection: 'angehoerige_identitaet',
    where: { pseudonymId: { equals: bedarfId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  const owner = (ident.docs[0] as { ownerUserId?: string } | undefined)?.ownerUserId
  if (!owner || owner !== userId) throw new Error('Kein Zugriff auf diesen Bedarf')

  const bedarf = await ladeBedarf(bedarfId)
  if (!bedarf) throw new Error('Bedarf nicht gefunden')
  if (!['offen', 'in_bearbeitung'].includes(bedarf.status)) {
    throw new Error('Bedarf kann nicht mehr zurückgezogen werden')
  }
  await payload.update({
    collection: 'bedarfe',
    where: { pseudonymId: { equals: bedarfId } },
    data: { status: 'abgesagt' },
    overrideAccess: true,
  })
  await entferneProbeEinsaetze(bedarfId)
}

export function bedarfAusDoc(d: any): unknown {
  return {
    pseudonymId: d.pseudonymId,
    geo: d.geo,
    pflegegrad: d.pflegegrad ?? undefined,
    leistungen: Array.isArray(d.leistungen) ? d.leistungen : [],
    qualifikation: Array.isArray(d.qualifikation) ? d.qualifikation : [],
    kostentraegerArt: d.kostentraegerArt ?? undefined,
    krankenversicherer: d.krankenversicherer ?? undefined,
    zeitfenster: d.zeitfenster,
    dauerMin: d.dauerMin ?? 30,
    express: Boolean(d.express),
    status: d.status ?? 'offen',
    matchingTenants: Array.isArray(d.matchingTenants) ? d.matchingTenants : [],
    selectedTenantId: d.selectedTenantId ?? undefined,
    deadlineAt: d.deadlineAt ? new Date(d.deadlineAt).toISOString() : undefined,
    firstResponseAt: d.firstResponseAt ? new Date(d.firstResponseAt).toISOString() : undefined,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
    uebernommenAt: d.uebernommenAt ? new Date(d.uebernommenAt).toISOString() : undefined,
  }
}
