import type { CollectionConfig } from 'payload'
import { tenantScoped, klientenSchreibAccess } from './access'

// SÄULE 2 — operatives Stammprofil einer Pflegekraft (pseudonym über
// pflegekraftId, KEIN PII). Der $jsonSchema-Validator (src/db/validators.ts)
// weist Name/E-Mail/Adresse/Telefon zusätzlich auf DB-Ebene ab.
export const PflegekraftStamm: CollectionConfig = {
  slug: 'pflegekraft_stamm',
  // dbName fixiert den Collection-Namen (sonst pluralisiert Payload) — muss
  // exakt dem Namen entsprechen, auf dem der PII-Validator liegt.
  dbName: 'pflegekraft_stamm',
  admin: { useAsTitle: 'pflegekraftId', group: 'Säule 2 (operativ)' },
  access: {
    read: tenantScoped,
    create: klientenSchreibAccess,
    update: klientenSchreibAccess,
    delete: klientenSchreibAccess,
  },
  fields: [
    { name: 'tenantId', type: 'text', required: true, index: true },
    // Verknüpfung zur Pflegekraft (Kürzel; identisch zu users.pflegekraftId und
    // touren.pflegekraftId). Eindeutig je Mandant über den DB-Index.
    { name: 'pflegekraftId', type: 'text', required: true, index: true },
    // Qualifikationen (z. B. ["grundpflege","behandlungspflege"]).
    { name: 'qualifikation', type: 'json', defaultValue: [] },
    { name: 'geschlecht', type: 'select', options: ['m', 'w', 'd'] },
    // Standard-Arbeitszeit in Minuten seit Mitternacht.
    { name: 'standardStartzeit', type: 'number' },
    { name: 'standardEndzeit', type: 'number' },
    { name: 'maxEinsaetze', type: 'number' },
    // Regelarbeitstage als ISO-Wochentage (1–7).
    { name: 'wochentage', type: 'json', defaultValue: [] },
  ],
}
