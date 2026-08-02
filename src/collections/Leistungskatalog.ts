import type { CollectionConfig } from 'payload'
import { tenantScoped, klientenSchreibAccess } from './access'

// Leistungskatalog je Mandant (§5.1.3): Leistungskomplexe mit Standardzeiten.
// Mandanten-Konfiguration (wie Abrechnungskonfiguration), kein PII — daher kein
// $jsonSchema-PII-Validator. Preise liegen weiterhin in Abrechnungskonfiguration.
export const Leistungskatalog: CollectionConfig = {
  slug: 'leistungskatalog',
  dbName: 'leistungskatalog',
  admin: { useAsTitle: 'code', group: 'Stammdaten' },
  access: {
    read: tenantScoped,
    create: klientenSchreibAccess,
    update: klientenSchreibAccess,
    delete: klientenSchreibAccess,
  },
  fields: [
    { name: 'tenantId', type: 'text', required: true, index: true },
    // Leistungskomplex-Code (z. B. LK01) — eindeutig je Mandant (Service-Upsert).
    { name: 'code', type: 'text', required: true, index: true },
    { name: 'bezeichnung', type: 'text' },
    { name: 'qualifikation', type: 'select', options: ['grundpflege', 'behandlungspflege'] },
    // Standard-Leistungszeit und -Grundzeit in Minuten.
    { name: 'dauerMin', type: 'number' },
    { name: 'grundzeitMin', type: 'number' },
    { name: 'aktiv', type: 'checkbox', defaultValue: true },
  ],
}
