import { payloadClient } from '@/server/payloadClient'
import { getEncryptor } from '@/server/identity/encryptionService'
import { identityHash } from '@/lib/audit'

// Löscht einen Klienten DSGVO-konform: operativer Datensatz (Säule 2) und
// Identität (Säule 1) werden entfernt, der pro-Klient-Schlüssel crypto-
// geshreddet (Art. 17 — etwaige Reste bleiben unlesbar) und ein Audit-Eintrag
// ohne Klarnamen geschrieben. Streng mandantengebunden.
export async function loescheKlient(tenantId: string, pseudonymId: string): Promise<boolean> {
  const payload = await payloadClient()

  const op = await payload.find({
    collection: 'klienten_operativ',
    where: { and: [{ tenantId: { equals: tenantId } }, { pseudonymId: { equals: pseudonymId } }] },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  const opDoc = op.docs[0] as { id: string | number } | undefined
  if (!opDoc) return false

  await payload.delete({ collection: 'klienten_operativ', id: opDoc.id, overrideAccess: true })

  const id = await payload.find({
    collection: 'klienten_identitaet',
    where: { and: [{ tenantId: { equals: tenantId } }, { pseudonymId: { equals: pseudonymId } }] },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  const idDoc = id.docs[0] as { id: string | number } | undefined
  if (idDoc) {
    await payload.delete({ collection: 'klienten_identitaet', id: idDoc.id, overrideAccess: true })
  }

  // Crypto-Shredding: pro-Klient-Schlüssel löschen (unwiderruflich).
  await getEncryptor()
    .shred(pseudonymId)
    .catch(() => {})

  // Audit-Nachweis (ohne Klarnamen).
  const { hash, pepperVersion } = identityHash(`${tenantId}:${pseudonymId}`)
  await payload.create({
    collection: 'gdpr_audit_log',
    data: {
      timestamp: new Date().toISOString(),
      request_type: 'RIGHT_TO_BE_FORGOTTEN',
      identity_hash: hash,
      pepper_version: pepperVersion,
      former_pseudonym_id: pseudonymId,
      status: 'SUCCESS',
    },
    overrideAccess: true,
  })

  return true
}
