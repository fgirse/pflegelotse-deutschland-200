import type { CollectionConfig } from 'payload'
import { tenantScoped } from './access'

// SÄULE 2 — eingegangene eVerordnungen (§8.2). Aufzeichnung der verordneten
// Leistungen + Zeitraum, pseudonym referenziert (pseudonymId). NIEMALS Patient-
// PII (der Name liegt in Säule 1). Append-only.
export const Verordnungen: CollectionConfig = {
  slug: 'verordnungen',
  dbName: 'verordnungen',
  admin: { useAsTitle: 'verordnungId', group: 'Säule 2 (operativ)' },
  access: {
    read: tenantScoped,
    create: () => true, // nur Server (overrideAccess)
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'verordnungId', type: 'text', required: true, unique: true, index: true },
    { name: 'tenantId', type: 'text', required: true, index: true },
    { name: 'pseudonymId', type: 'text', required: true, index: true },
    { name: 'leistungen', type: 'json', defaultValue: [] },
    { name: 'zeitraumVon', type: 'text' }, // ISO YYYY-MM-DD
    { name: 'zeitraumBis', type: 'text' },
    { name: 'pflegegrad', type: 'number', min: 1, max: 5 },
    { name: 'verordnetVon', type: 'text' }, // LANR/BSNR/Praxis (kein Patient-PII)
    { name: 'eingegangenAm', type: 'text' },
  ],
}
