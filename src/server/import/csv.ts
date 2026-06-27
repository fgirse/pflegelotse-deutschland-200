import { payloadClient } from '@/server/payloadClient'
import { neuePseudonymId } from '@/lib/pseudonym'
import { identityHash } from '@/lib/audit'
import { geocode } from '@/server/geo/service'
import { hhmmToMin } from '@/shared/time'

// Reiner Parser ist in ./parse ausgelagert (eigenständig testbar, ohne DB).
export { parseCsv } from './parse'
export type { CsvDaten } from './parse'

export interface ImportFehler {
  externalId: string
  grund: string
}
export interface ImportErgebnis {
  verarbeitet: number
  neu: number
  aktualisiert: number
  fehler: ImportFehler[]
}

// Importiert Klienten aus (bereits auf unsere Feldnamen gemappten) Zeilen und
// teilt sie SOFORT in beide Säulen (/F550/): PII → Säule 1 (verschlüsselt via
// Collection-Hooks), operative Daten → Säule 2. Idempotent über externalId
// (/F540/). Fehlen Koordinaten, wird die Adresse geokodiert.
export async function importiereKlienten(
  tenantId: string,
  rows: Record<string, string>[],
): Promise<ImportErgebnis> {
  const payload = await payloadClient()
  let neu = 0
  let aktualisiert = 0
  const fehler: ImportFehler[] = []

  for (const row of rows) {
    const externalId = (row.external_id || row.externalId || '').trim()
    if (!externalId) {
      fehler.push({ externalId: '(leer)', grund: 'Eindeutige Kennung (external_id) fehlt' })
      continue
    }

    // Koordinaten: direkt aus lat/lng oder per Geokodierung der Adresse.
    let lat = Number((row.lat ?? '').replace(',', '.'))
    let lng = Number((row.lng ?? '').replace(',', '.'))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const adresse = [row.adresse, row.ort].map((x) => x?.trim()).filter(Boolean).join(', ')
      if (adresse) {
        const treffer = await geocode(adresse)
        if (treffer) {
          lat = treffer.lat
          lng = treffer.lng
        }
      }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      fehler.push({ externalId, grund: 'Keine Koordinaten (Adresse nicht gefunden)' })
      continue
    }

    const treffer = await payload.find({
      collection: 'klienten_identitaet',
      where: { and: [{ tenantId: { equals: tenantId } }, { externalId: { equals: externalId } }] },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })
    const vorhanden = treffer.docs[0]
    const pseudonymId = (vorhanden?.pseudonymId as string) ?? neuePseudonymId()

    // ── Säule 1: PII (wird durch Collection-Hooks verschlüsselt) ──
    const piiDaten = {
      pseudonymId,
      tenantId,
      externalId,
      vorname: row.vorname ?? '',
      nachname: row.nachname ?? '',
      adresse: row.adresse ?? '',
      telefon: row.telefon ?? '',
      email: row.email ?? '',
    }
    if (vorhanden) {
      await payload.update({ collection: 'klienten_identitaet', id: vorhanden.id, data: piiDaten, overrideAccess: true })
    } else {
      await payload.create({ collection: 'klienten_identitaet', data: piiDaten, overrideAccess: true })
    }

    // ── Säule 2: operative Daten (niemals PII) ──
    const operativDaten = {
      pseudonymId,
      tenantId,
      geo: { lat, lng },
      pflegegrad: row.pflegegrad ? Number(row.pflegegrad) : undefined,
      leistungen: splitListe(row.leistungen),
      qualifikation: splitListe(row.qualifikation),
      zeitfenster: { von: zeitZuMin(row.zeitfenster_von) ?? 480, bis: zeitZuMin(row.zeitfenster_bis) ?? 1080 },
      dauerMin: zeitZuMin(row.dauer) ?? 30,
      status: 'aktiv' as const,
    }
    const opTreffer = await payload.find({
      collection: 'klienten_operativ',
      where: { pseudonymId: { equals: pseudonymId } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })
    if (opTreffer.docs[0]) {
      await payload.update({ collection: 'klienten_operativ', id: opTreffer.docs[0].id, data: operativDaten, overrideAccess: true })
    } else {
      await payload.create({ collection: 'klienten_operativ', data: operativDaten, overrideAccess: true })
    }

    if (vorhanden) aktualisiert++
    else neu++

    // Audit-Eintrag (ohne Klarnamen).
    const { hash, pepperVersion } = identityHash(`${tenantId}:${externalId}`)
    await payload.create({
      collection: 'gdpr_audit_log',
      data: {
        timestamp: new Date().toISOString(),
        request_type: 'IMPORT',
        identity_hash: hash,
        pepper_version: pepperVersion,
        former_pseudonym_id: pseudonymId,
        status: 'SUCCESS',
      },
      overrideAccess: true,
    })
  }

  return { verarbeitet: neu + aktualisiert, neu, aktualisiert, fehler }
}

// "LK01;LK15" oder "LK01, LK15" → ["LK01","LK15"]
function splitListe(v: string | undefined): string[] {
  if (!v) return []
  return v
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// Zeit akzeptiert "HH:MM" (aus Pflegesoftware) ODER Minuten seit Mitternacht.
function zeitZuMin(v: string | undefined): number | undefined {
  if (!v) return undefined
  if (v.includes(':')) return hhmmToMin(v)
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}
