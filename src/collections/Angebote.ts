import type { CollectionConfig } from 'payload'
import { istDienstMitarbeiter } from './access'

// SÄULE 2 — verbindliche Angebote der Dienste auf einen Bedarf.
// Ein eindeutiger Index (bedarfPseudonymId + tenantId) verhindert
// Doppelangebote desselben Dienstes (Statusmarker /F320/).
export const Angebote: CollectionConfig = {
  slug: 'angebote',
  dbName: 'angebote',
  admin: { useAsTitle: 'id', group: 'Säule 2 (operativ)' },
  access: {
    read: istDienstMitarbeiter,
    create: () => false, // nur Server
    update: () => false,
    delete: () => false,
  },
  indexes: [{ fields: ['bedarfPseudonymId', 'tenantId'], unique: true }],
  fields: [
    { name: 'bedarfPseudonymId', type: 'text', required: true, index: true },
    { name: 'tenantId', type: 'text', required: true, index: true },
    { name: 'nachricht', type: 'textarea' },
    { name: 'mehrwegMin', type: 'number' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'abgegeben',
      options: ['abgegeben', 'zurueckgezogen'],
    },
    { name: 'createdAt', type: 'date' },
  ],
}
