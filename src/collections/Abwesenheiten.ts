import type { CollectionConfig } from 'payload'
import { tenantScoped, klientenSchreibAccess } from './access'

// SÄULE 2 — Abwesenheiten einer Pflegekraft (Urlaub/Krankheit), pseudonym über
// pflegekraftId. KEIN PII: der $jsonSchema-Validator (src/db/validators.ts)
// weist Name/E-Mail/Adresse/Telefon zusätzlich auf DB-Ebene ab. Der Typ
// „krankheit" ist ein Gesundheitshinweis, aber nur pseudonym (Kürzel).
export const Abwesenheiten: CollectionConfig = {
  slug: 'abwesenheiten',
  dbName: 'abwesenheiten',
  admin: { useAsTitle: 'pflegekraftId', group: 'Säule 2 (operativ)' },
  access: {
    read: tenantScoped,
    create: klientenSchreibAccess,
    update: klientenSchreibAccess,
    delete: klientenSchreibAccess,
  },
  fields: [
    { name: 'tenantId', type: 'text', required: true, index: true },
    { name: 'pflegekraftId', type: 'text', required: true, index: true },
    // Zeitraum als YYYY-MM-DD (String) — passt direkt zum Datum der Wochenplanung.
    { name: 'von', type: 'text', required: true },
    { name: 'bis', type: 'text', required: true },
    {
      name: 'typ',
      type: 'select',
      defaultValue: 'urlaub',
      options: ['urlaub', 'krankheit', 'sonstiges'],
    },
    { name: 'notiz', type: 'text' },
  ],
}
