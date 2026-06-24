import type { CollectionConfig } from 'payload'
import { piiFeld } from './piiHooks'

// SÄULE 1 — identifizierende Klientendaten (PII). Alle PII-Felder werden vor
// dem Schreiben mit dem pro-Klient-Schlüssel verschlüsselt (Encryption-Port)
// und erst beim Lesen wieder entschlüsselt. Wird der Schlüssel crypto-
// geshreddet (Art. 17), liefern die Felder null — unumkehrbar unlesbar.
const PII_FELDER = ['vorname', 'nachname', 'adresse', 'telefon', 'email'] as const

export const KlientenIdentitaet: CollectionConfig = {
  slug: 'klienten_identitaet',
  dbName: 'klienten_identitaet', // keine Pluralisierung
  admin: { useAsTitle: 'pseudonymId', group: 'Säule 1 (Identität · CSFLE)' },
  access: {
    // Bewusst eng: nur Disponent/Admin des Mandanten (Gatekeeper-nah).
    read: ({ req: { user } }) => {
      const u = user as { role?: string; tenantId?: string } | null
      if (!u || !u.tenantId) return false
      if (!['disponent', 'admin'].includes(u.role ?? '')) return false
      return { tenantId: { equals: u.tenantId } }
    },
    create: ({ req: { user } }) =>
      Boolean(user && ['disponent', 'admin'].includes((user as { role?: string }).role ?? '')),
    update: ({ req: { user } }) =>
      Boolean(user && ['disponent', 'admin'].includes((user as { role?: string }).role ?? '')),
    delete: ({ req: { user } }) =>
      Boolean(user && ['admin'].includes((user as { role?: string }).role ?? '')),
  },
  fields: [
    { name: 'pseudonymId', type: 'text', required: true, unique: true, index: true },
    { name: 'tenantId', type: 'text', required: true, index: true },
    // Externer Quell-Schlüssel aus dem ERP — Basis für idempotenten Import (/F540/).
    // Kein Klarname, aber ein Re-Identifizierer → bleibt in Säule 1.
    { name: 'externalId', type: 'text', index: true },
    ...PII_FELDER.map(piiFeld),
  ],
}
