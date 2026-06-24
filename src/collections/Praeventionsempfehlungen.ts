import type { CollectionConfig } from 'payload'
import { tenantScoped, klientenSchreibAccess } from './access'

// SÄULE 2 — Präventionsempfehlungen (BEEP, §5 Abs. 1a SGB XI). Pseudonym,
// keine PII. Pro Klient kann es mehrere Erhebungen geben.
export const Praeventionsempfehlungen: CollectionConfig = {
  slug: 'praeventionsempfehlungen',
  dbName: 'praeventionsempfehlungen', // keine Pluralisierung
  admin: { useAsTitle: 'id', group: 'Säule 2 (operativ)' },
  access: {
    read: tenantScoped,
    create: klientenSchreibAccess,
    update: klientenSchreibAccess,
    delete: klientenSchreibAccess,
  },
  fields: [
    { name: 'pseudonymId', type: 'text', required: true, index: true },
    { name: 'tenantId', type: 'text', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'entwurf',
      options: ['entwurf', 'finalisiert'],
      index: true,
    },
    { name: 'felder', type: 'json', defaultValue: [] }, // FeldErhebung[]
    { name: 'empfehlungen', type: 'json', defaultValue: [] }, // Empfehlung[]
    { name: 'freitext', type: 'textarea' },
    { name: 'erstelltVon', type: 'text' },
  ],
}
