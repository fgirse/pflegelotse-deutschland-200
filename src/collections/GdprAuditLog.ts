import type { CollectionConfig } from 'payload'

// WORM-Audit-Log (Write-Once-Read-Many). Protokolliert datenschutzrelevante
// Vorgänge (Löschung, Auskunft) ohne Klarnamen — nur HMAC-Hash + pepper_version.
// Update und Delete sind über die App-Schicht gesperrt; zusätzlich verweigert
// der DB-Service-Account `remove` (Revisionssicherheit).
export const GdprAuditLog: CollectionConfig = {
  slug: 'gdpr_audit_log',
  dbName: 'gdpr_audit_log', // keine Pluralisierung
  admin: { useAsTitle: 'request_type', group: 'Datenschutz' },
  access: {
    read: ({ req: { user } }) =>
      Boolean(user && (user as { role?: string }).role === 'plattform_admin'),
    create: () => true, // System schreibt Audit-Einträge
    update: () => false, // append-only
    delete: () => false, // append-only
  },
  fields: [
    { name: 'timestamp', type: 'date', required: true },
    {
      name: 'request_type',
      type: 'select',
      required: true,
      options: ['RIGHT_TO_BE_FORGOTTEN', 'RIGHT_TO_ACCESS', 'IMPORT', 'CONTACT_RELEASE'],
    },
    { name: 'identity_hash', type: 'text', required: true }, // HMAC, kein Klarname
    { name: 'pepper_version', type: 'text', required: true },
    { name: 'former_pseudonym_id', type: 'text' },
    { name: 'status', type: 'select', options: ['SUCCESS', 'FAILURE'], defaultValue: 'SUCCESS' },
  ],
}
