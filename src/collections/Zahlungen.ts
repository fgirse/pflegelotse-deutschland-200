import type { CollectionConfig } from 'payload'
import { istDienstMitarbeiter } from './access'

// Zahlungen & Gebühren-Ledger (Säule 2, keine PII). Deckt drei Arten ab:
// - express:  einmalige Angehörigen-Zahlung (/F1020/)
// - gebuehr:  Vermittlungsgebühr je Kontaktfreigabe (/F1040/, leck-sicher)
// - abo:      SaaS-Abo-Posten der Dienste (/F1030/)
// Schreiben erfolgt serverseitig (overrideAccess); Lesen für Mitarbeiter.
export const Zahlungen: CollectionConfig = {
  slug: 'zahlungen',
  dbName: 'zahlungen',
  admin: { useAsTitle: 'id', group: 'Abrechnung' },
  access: {
    read: istDienstMitarbeiter,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'art', type: 'select', required: true, options: ['express', 'gebuehr', 'abo'] },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'offen',
      options: ['offen', 'bezahlt', 'fehlgeschlagen', 'storniert', 'abgelaufen'],
      index: true,
    },
    { name: 'betragCents', type: 'number', required: true },
    { name: 'waehrung', type: 'text', defaultValue: 'EUR' },
    { name: 'beschreibung', type: 'text' },
    // Verknüpfungen (pseudonym): Express → Bedarf, Gebühr/Abo → Dienst-Mandant.
    { name: 'bedarfId', type: 'text', index: true },
    { name: 'tenantId', type: 'text', index: true },
    // Mollie-Zahlungs-ID (für Express/Abo; Gebühr-Ledger kann ohne sein).
    { name: 'molliePaymentId', type: 'text', index: true },
    { name: 'paidAt', type: 'date' },
  ],
}
