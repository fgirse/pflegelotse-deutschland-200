import type { CollectionConfig } from 'payload'
import { istDienstMitarbeiter } from './access'

// SaaS-Abos der Dienste (/F1030/). Ein Abo gehört einem Mandanten und verweist
// auf den Mollie-Kunden und die -Subscription. Keine PII.
// Status: ausstehend (Mandat/Erstzahlung offen) → aktiv → gekuendigt/fehlgeschlagen.
export const Abos: CollectionConfig = {
  slug: 'abos',
  dbName: 'abos',
  admin: { useAsTitle: 'tenantId', group: 'Abrechnung' },
  access: {
    read: istDienstMitarbeiter,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'tenantId', type: 'text', required: true, index: true },
    { name: 'stufe', type: 'select', required: true, options: ['klein', 'mittel', 'gross'] },
    { name: 'monatlichCents', type: 'number', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'ausstehend',
      options: ['ausstehend', 'aktiv', 'gekuendigt', 'fehlgeschlagen'],
      index: true,
    },
    { name: 'mollieCustomerId', type: 'text', index: true },
    { name: 'mollieSubscriptionId', type: 'text', index: true },
    // Mollie-Zahlungs-ID der mandatsbildenden Erstzahlung.
    { name: 'firstPaymentId', type: 'text', index: true },
    { name: 'activatedAt', type: 'date' },
  ],
}
