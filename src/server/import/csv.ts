import { payloadClient } from '@/server/payloadClient'
import { neuePseudonymId } from '@/lib/pseudonym'
import { identityHash } from '@/lib/audit'

// Minimaler CSV-Parser (keine externe Abhängigkeit). Erwartet Komma als
// Trennzeichen und eine Kopfzeile. Felder mit Komma sind in diesem MVP
// nicht unterstützt (synthetische Importe halten sich daran).
export function parseCsv(text: string): Record<string, string>[] {
  const zeilen = text
    .split(/\r?\n/)
    .map((z) => z.trim())
    .filter(Boolean)
  if (zeilen.length < 2) return []
  const header = zeilen[0].split(',').map((h) => h.trim())
  return zeilen.slice(1).map((zeile) => {
    const werte = zeile.split(',')
    const obj: Record<string, string> = {}
    header.forEach((h, i) => (obj[h] = (werte[i] ?? '').trim()))
    return obj
  })
}

export interface ImportErgebnis {
  verarbeitet: number
  neu: number
  aktualisiert: number
}

// Importiert Klienten aus CSV und teilt sie SOFORT in beide Säulen (/F550/):
// PII → Säule 1 (verschlüsselt via Collection-Hooks), operative Daten → Säule 2.
// Idempotent über externalId (/F540/): erneuter Import aktualisiert statt zu duplizieren.
export async function importiereKlienten(
  tenantId: string,
  rows: Record<string, string>[],
): Promise<ImportErgebnis> {
  const payload = await payloadClient()
  let neu = 0
  let aktualisiert = 0

  for (const row of rows) {
    const externalId = row.external_id || row.externalId
    if (!externalId) continue

    // Vorhandene Identität anhand des externen Schlüssels suchen.
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
      vorname: row.vorname,
      nachname: row.nachname,
      adresse: row.adresse,
      telefon: row.telefon,
      email: row.email,
    }
    if (vorhanden) {
      await payload.update({
        collection: 'klienten_identitaet',
        id: vorhanden.id,
        data: piiDaten,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'klienten_identitaet',
        data: piiDaten,
        overrideAccess: true,
      })
    }

    // ── Säule 2: operative Daten (niemals PII) ──
    const operativDaten = {
      pseudonymId,
      tenantId,
      geo: { lat: Number(row.lat), lng: Number(row.lng) },
      pflegegrad: row.pflegegrad ? Number(row.pflegegrad) : undefined,
      leistungen: splitListe(row.leistungen),
      qualifikation: splitListe(row.qualifikation),
      zeitfenster: { von: Number(row.zeitfenster_von), bis: Number(row.zeitfenster_bis) },
      dauerMin: row.dauer ? Number(row.dauer) : 30,
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
      await payload.update({
        collection: 'klienten_operativ',
        id: opTreffer.docs[0].id,
        data: operativDaten,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'klienten_operativ',
        data: operativDaten,
        overrideAccess: true,
      })
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

  return { verarbeitet: neu + aktualisiert, neu, aktualisiert }
}

// "LK01;LK15" → ["LK01","LK15"]
function splitListe(v: string | undefined): string[] {
  if (!v) return []
  return v
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}
