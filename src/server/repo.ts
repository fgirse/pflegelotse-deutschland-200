import type { Where } from 'payload'
import { payloadClient } from './payloadClient'
import {
  tourSchema,
  stammtourSchema,
  klientOperativSchema,
  type Tour,
  type KlientOperativ,
  type Stammtour,
} from '@/shared/domain'
import { tourSchluessel, type TourEntwurf } from './planning/wochenplan'
import type { NachweisEintrag } from './nachweis/kette'
import { ladePflegekraftStamm } from './stammdaten/service'

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

// Eingabe zum Anlegen einer neuen (leeren) Tour. tenantId kommt serverseitig
// aus dem angemeldeten Nutzer; id vergibt die DB.
export type NeueTour = {
  tenantId: string
  datum: string // ISO YYYY-MM-DD
  pflegekraftId: string
  pflegekraftQualifikation?: string[]
  pflegekraftGeschlecht?: 'm' | 'w' | 'd'
  start: { lat: number; lng: number } // Depot/Startpunkt
  startZeit?: number // Min seit Mitternacht
  verfuegbarBis?: number // Schichtende (Min seit Mitternacht)
  maxEinsaetze?: number
}

// Legt eine neue Tour ohne Einsätze an (Disponent plant sie danach voll).
// Erbt Qualifikation/Geschlecht/Arbeitszeit aus dem Pflegekraft-Stammprofil,
// sofern nicht explizit angegeben — explizite Eingabe hat immer Vorrang.
export async function erstelleTour(input: NeueTour): Promise<Tour> {
  const payload = await payloadClient()
  const stamm = await ladePflegekraftStamm(input.tenantId, input.pflegekraftId)

  const qualifikation =
    input.pflegekraftQualifikation && input.pflegekraftQualifikation.length > 0
      ? input.pflegekraftQualifikation
      : (stamm?.qualifikation ?? [])
  const geschlecht = input.pflegekraftGeschlecht ?? stamm?.geschlecht
  const startZeit = input.startZeit ?? stamm?.standardStartzeit ?? 480
  const verfuegbarBis = input.verfuegbarBis ?? stamm?.standardEndzeit
  const maxEinsaetze = input.maxEinsaetze ?? stamm?.maxEinsaetze

  const d = await payload.create({
    collection: 'touren',
    data: {
      tenantId: input.tenantId,
      datum: input.datum,
      pflegekraftId: input.pflegekraftId,
      pflegekraftQualifikation: qualifikation,
      start: input.start,
      startZeit,
      einsaetze: [],
      // Nur setzen, wenn vorhanden (aus Eingabe oder Stammprofil).
      ...(geschlecht ? { pflegekraftGeschlecht: geschlecht } : {}),
      ...(typeof verfuegbarBis === 'number' ? { verfuegbarBis } : {}),
      ...(typeof maxEinsaetze === 'number' ? { maxEinsaetze } : {}),
    },
    overrideAccess: true,
    depth: 0,
  })
  return tourSchema.parse(normTour(d))
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

// ── Stammtouren / Wochenplanung (§5.2.2) ──────────────────────────────────

// Liest die Stammtouren eines Mandanten.
export async function ladeStammtouren(tenantId: string): Promise<Stammtour[]> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'stammtouren',
    where: { tenantId: { equals: tenantId } },
    limit: 200,
    overrideAccess: true,
    depth: 0,
  })
  return res.docs.map((d) => stammtourSchema.parse(normStammtour(d)))
}

// Sammelt die Idempotenz-Schlüssel (stammtourId|datum) bereits generierter
// Touren eines Mandanten für die gegebenen Tage — damit die Wochengenerierung
// bestehende Tag-Touren nicht überschreibt.
export async function ladeGenerierteTourKeys(
  tenantId: string,
  tage: string[],
): Promise<Set<string>> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'touren',
    where: {
      tenantId: { equals: tenantId },
      datum: { in: tage },
      stammtourId: { exists: true },
    },
    limit: 500,
    overrideAccess: true,
    depth: 0,
  })
  const keys = new Set<string>()
  for (const d of res.docs) {
    const s = (d as { stammtourId?: string }).stammtourId
    const datum = (d as { datum?: string }).datum
    if (s && datum) keys.add(tourSchluessel({ stammtourId: s, datum }))
  }
  return keys
}

// Legt eine generierte Tour aus einem Entwurf an (mit Rückverweis stammtourId).
export async function erstelleGenerierteTour(entwurf: TourEntwurf): Promise<Tour> {
  const payload = await payloadClient()
  const d = await payload.create({
    collection: 'touren',
    data: {
      tenantId: entwurf.tenantId,
      datum: entwurf.datum,
      pflegekraftId: entwurf.pflegekraftId,
      pflegekraftQualifikation: entwurf.pflegekraftQualifikation,
      pflegekraftGeschlecht: entwurf.pflegekraftGeschlecht,
      start: entwurf.start,
      ende: entwurf.ende,
      startZeit: entwurf.startZeit,
      verfuegbarBis: entwurf.verfuegbarBis,
      maxEinsaetze: entwurf.maxEinsaetze,
      stammtourId: entwurf.stammtourId,
      einsaetze: entwurf.einsaetze,
    },
    overrideAccess: true,
    depth: 0,
  })
  return tourSchema.parse(normTour(d))
}

// ── Leistungsnachweis (§5.4, WORM/hash-verkettet) ─────────────────────────

// Hash des jüngsten Nachweis-Eintrags eines Mandanten (Ketten-Kopf) — leer,
// wenn noch keiner existiert.
export async function ladeKettenKopf(tenantId: string): Promise<string> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'leistungsnachweise',
    where: { tenantId: { equals: tenantId } },
    sort: '-createdAt',
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  return res.docs[0] ? String((res.docs[0] as { hash?: string }).hash ?? '') : ''
}

// Hängt einen Nachweis-Eintrag an (append-only). aktionId dedupliziert
// nachgespielte Offline-Erfassungen (§5.3).
export async function erstelleNachweis(
  tenantId: string,
  e: NachweisEintrag,
  pepperVersion: string,
  aktionId?: string,
): Promise<void> {
  const payload = await payloadClient()
  await payload.create({
    collection: 'leistungsnachweise',
    data: { tenantId, ...e, pepperVersion, aktionId },
    overrideAccess: true,
    depth: 0,
  })
}

// Prüft, ob zu einer Client-Aktions-ID bereits ein Nachweis existiert (Idempotenz).
export async function existiertNachweisAktion(tenantId: string, aktionId: string): Promise<boolean> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'leistungsnachweise',
    where: { tenantId: { equals: tenantId }, aktionId: { equals: aktionId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  return res.docs.length > 0
}

// Lädt die Nachweis-Einträge eines Mandanten (optional je Klient), chronologisch.
export async function ladeNachweise(tenantId: string, pseudonymId?: string): Promise<NachweisEintrag[]> {
  const payload = await payloadClient()
  const where: Where = { tenantId: { equals: tenantId } }
  if (pseudonymId) where.pseudonymId = { equals: pseudonymId }
  const res = await payload.find({
    collection: 'leistungsnachweise',
    where,
    sort: 'createdAt',
    limit: 2000,
    overrideAccess: true,
    depth: 0,
  })
  return res.docs.map(normNachweis)
}

// ── eVerordnung / TI (§8.2) ───────────────────────────────────────────────

export async function existiertVerordnung(tenantId: string, verordnungId: string): Promise<boolean> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'verordnungen',
    where: { tenantId: { equals: tenantId }, verordnungId: { equals: verordnungId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  return res.docs.length > 0
}

export async function erstelleVerordnung(v: {
  verordnungId: string
  tenantId: string
  pseudonymId: string
  leistungen: string[]
  zeitraumVon: string
  zeitraumBis: string
  pflegegrad?: number
  verordnetVon?: string
  eingegangenAm: string
}): Promise<void> {
  const payload = await payloadClient()
  await payload.create({ collection: 'verordnungen', data: v, overrideAccess: true, depth: 0 })
}

// Legt eine Patienten-Identität an (Säule 1, CSFLE-Hooks verschlüsseln).
export async function erstelleIdentitaet(i: {
  pseudonymId: string
  tenantId: string
  externalId?: string
  vorname: string
  nachname: string
  adresse: string
}): Promise<void> {
  const payload = await payloadClient()
  await payload.create({ collection: 'klienten_identitaet', data: i, overrideAccess: true, depth: 0 })
}

// Legt einen operativen Klienten an (Säule 2, pseudonym).
export async function erstelleKlientOperativ(o: {
  pseudonymId: string
  tenantId: string
  geo: { lat: number; lng: number }
  pflegegrad?: number
  leistungen: string[]
  qualifikation: string[]
  zeitfenster: { von: number; bis: number }
  dauerMin: number
  status: 'aktiv' | 'pausiert' | 'beendet'
}): Promise<void> {
  const payload = await payloadClient()
  await payload.create({ collection: 'klienten_operativ', data: o, overrideAccess: true, depth: 0 })
}

// ── Abrechnung (§8.3) ─────────────────────────────────────────────────────

export interface Abrechnungskonfig {
  preise: Record<string, number>
  beraterNr?: string
  mandantenNr?: string
  wjBeginn?: string
  sachkontenlaenge?: number
  erloesKonto?: string
  debitorKonto?: string
}

export async function ladeAbrechnungskonfig(tenantId: string): Promise<Abrechnungskonfig | null> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'abrechnungskonfiguration',
    where: { tenantId: { equals: tenantId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  const d = res.docs[0] as any
  if (!d) return null
  return {
    preise: d.preise && typeof d.preise === 'object' ? d.preise : {},
    beraterNr: d.beraterNr ?? undefined,
    mandantenNr: d.mandantenNr ?? undefined,
    wjBeginn: d.wjBeginn ?? undefined,
    sachkontenlaenge: typeof d.sachkontenlaenge === 'number' ? d.sachkontenlaenge : undefined,
    erloesKonto: d.erloesKonto ?? undefined,
    debitorKonto: d.debitorKonto ?? undefined,
  }
}

// Klarnamen (Säule 1, CSFLE) für mehrere Klienten auf einmal — für die
// Abrechnungs-Exporte (server-seitig, geschützt). Nie zurück nach Säule 2.
export async function ladeIdentitaeten(
  tenantId: string,
  pseudonymIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (pseudonymIds.length === 0) return map
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'klienten_identitaet',
    where: { tenantId: { equals: tenantId }, pseudonymId: { in: pseudonymIds } },
    limit: 1000,
    overrideAccess: true,
    depth: 0,
  })
  for (const d of res.docs as any[]) {
    const name = [d.vorname, d.nachname].filter(Boolean).join(' ')
    if (d.pseudonymId && name) map.set(d.pseudonymId, name)
  }
  return map
}

export interface KlientIdentitaet {
  vorname?: string
  nachname?: string
  adresse?: string
}

// Liest die Klarnamen-Identität aus Säule 1 (CSFLE) — NUR für die Nachweis-
// Erzeugung, server-seitig und geschützt. Wird nie zurück in Säule 2 geschrieben.
export async function ladeKlientIdentitaet(
  tenantId: string,
  pseudonymId: string,
): Promise<KlientIdentitaet | null> {
  const payload = await payloadClient()
  const res = await payload.find({
    collection: 'klienten_identitaet',
    where: { tenantId: { equals: tenantId }, pseudonymId: { equals: pseudonymId } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  const d = res.docs[0] as { vorname?: string; nachname?: string; adresse?: string } | undefined
  return d ? { vorname: d.vorname, nachname: d.nachname, adresse: d.adresse } : null
}

// Aktualisiert Felder einer Tour (Einsätze und/oder Verfügbarkeit) — für die
// kurzfristige Umplanung (§5.2.2): aufgelöste Tour auf verfuegbar=false setzen.
export async function aktualisiereTour(
  id: string,
  data: { einsaetze?: Tour['einsaetze']; verfuegbar?: boolean },
): Promise<Tour> {
  const payload = await payloadClient()
  const d = await payload.update({ collection: 'touren', id, data, overrideAccess: true, depth: 0 })
  return tourSchema.parse(normTour(d))
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
    pflegekraftGeschlecht: d.pflegekraftGeschlecht ?? undefined,
    start: d.start,
    // Endpunkt nur übernehmen, wenn echte Koordinaten vorliegen (die
    // optionale Payload-Group liefert sonst null-Felder).
    ende:
      d.ende && typeof d.ende.lat === 'number' && typeof d.ende.lng === 'number'
        ? { lat: d.ende.lat, lng: d.ende.lng }
        : undefined,
    startZeit: d.startZeit ?? 480,
    verfuegbar: d.verfuegbar ?? true,
    verfuegbarBis: typeof d.verfuegbarBis === 'number' ? d.verfuegbarBis : undefined,
    maxEinsaetze: typeof d.maxEinsaetze === 'number' ? d.maxEinsaetze : undefined,
    stammtourId: d.stammtourId ?? undefined,
    einsaetze: arr(d.einsaetze).map((e) => ({
      pseudonymId: e.pseudonymId,
      geo: e.geo,
      zeitfenster: e.zeitfenster,
      dauerMin: e.dauerMin ?? 30,
      qualifikation: arr(e.qualifikation),
      ankunft: e.ankunft,
      probe: Boolean(e.probe),
      istAnkunft: typeof e.istAnkunft === 'number' ? e.istAnkunft : undefined,
      istAbfahrt: typeof e.istAbfahrt === 'number' ? e.istAbfahrt : undefined,
      erledigt: Boolean(e.erledigt),
      abweichungGrund: e.abweichungGrund ?? undefined,
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
    kostentraegerArt: d.kostentraegerArt ?? undefined,
    krankenversicherer: d.krankenversicherer ?? undefined,
    bezugspflege: d.bezugspflege,
    geschlechtPraeferenz: d.geschlechtPraeferenz ?? undefined,
    status: d.status ?? 'aktiv',
  }
}

function normStammtour(d: any): unknown {
  return {
    id: String(d.id),
    tenantId: d.tenantId,
    pflegekraftId: d.pflegekraftId,
    pflegekraftQualifikation: arr(d.pflegekraftQualifikation),
    pflegekraftGeschlecht: d.pflegekraftGeschlecht ?? undefined,
    start: d.start,
    ende:
      d.ende && typeof d.ende.lat === 'number' && typeof d.ende.lng === 'number'
        ? { lat: d.ende.lat, lng: d.ende.lng }
        : undefined,
    startZeit: d.startZeit ?? 480,
    verfuegbarBis: typeof d.verfuegbarBis === 'number' ? d.verfuegbarBis : undefined,
    maxEinsaetze: typeof d.maxEinsaetze === 'number' ? d.maxEinsaetze : undefined,
    wochentage: arr(d.wochentage),
    aktivAb: d.aktivAb ?? undefined,
    aktivBis: d.aktivBis ?? undefined,
    einsaetze: arr(d.einsaetze).map((e) => ({
      pseudonymId: e.pseudonymId,
      geo: e.geo,
      zeitfenster: e.zeitfenster,
      dauerMin: e.dauerMin ?? 30,
      grundzeitMin: typeof e.grundzeitMin === 'number' ? e.grundzeitMin : undefined,
      qualifikation: arr(e.qualifikation),
      wochentage: Array.isArray(e.wochentage) ? e.wochentage : undefined,
    })),
  }
}

function normNachweis(d: any): NachweisEintrag {
  return {
    pseudonymId: d.pseudonymId,
    datum: d.datum,
    tourId: d.tourId,
    erbrachteLeistungen: arr(d.erbrachteLeistungen),
    istAnkunft: typeof d.istAnkunft === 'number' ? d.istAnkunft : undefined,
    istAbfahrt: typeof d.istAbfahrt === 'number' ? d.istAbfahrt : undefined,
    bestaetigtAm: d.bestaetigtAm,
    bestaetigtVon: d.bestaetigtVon,
    prevHash: d.prevHash,
    hash: d.hash,
  }
}

// Hilfsfunktion: stellt sicher, dass JSON-Felder als Array vorliegen.
function arr(v: unknown): any[] {
  return Array.isArray(v) ? v : []
}
