import type { CollectionConfig } from 'payload'
import { tenantScoped, klientenSchreibAccess } from './access'

// SÄULE 2 — operative, pseudonymisierte Klientendaten. NIEMALS PII.
// Der serverseitige $jsonSchema-Validator (src/db/validators.ts) weist
// Name/Adresse/Telefon zusätzlich auf DB-Ebene ab — zweite Verteidigungslinie.
export const KlientenOperativ: CollectionConfig = {
  slug: 'klienten_operativ',
  // dbName fixiert den MongoDB-Collection-Namen (sonst pluralisiert Payload zu
  // „klienten_operativs"). Muss exakt der Name sein, auf dem der
  // $jsonSchema-PII-Validator liegt — sonst griffe die Sperre ins Leere.
  dbName: 'klienten_operativ',
  admin: { useAsTitle: 'pseudonymId', group: 'Säule 2 (operativ)' },
  access: {
    read: tenantScoped,
    create: klientenSchreibAccess,
    update: klientenSchreibAccess,
    delete: klientenSchreibAccess,
  },
  fields: [
    { name: 'pseudonymId', type: 'text', required: true, unique: true, index: true },
    { name: 'tenantId', type: 'text', required: true, index: true },
    {
      name: 'geo',
      type: 'group',
      fields: [
        { name: 'lat', type: 'number', required: true },
        { name: 'lng', type: 'number', required: true },
      ],
    },
    { name: 'pflegegrad', type: 'number', min: 1, max: 5 },
    { name: 'leistungen', type: 'json', defaultValue: [] }, // Leistungskomplex-Codes
    { name: 'qualifikation', type: 'json', defaultValue: [] },
    {
      name: 'zeitfenster',
      type: 'group',
      fields: [
        { name: 'von', type: 'number', required: true }, // Minuten seit Mitternacht
        { name: 'bis', type: 'number', required: true },
      ],
    },
    { name: 'dauerMin', type: 'number', defaultValue: 30 },
    // Kostenträger aus dem übernommenen Bedarf — relevant für die Abrechnung.
    { name: 'kostentraegerArt', type: 'select', options: ['gesetzlich', 'privat'], index: true },
    { name: 'krankenversicherer', type: 'text' },
    { name: 'bezugspflege', type: 'text' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'aktiv',
      options: ['aktiv', 'pausiert', 'beendet'],
    },
  ],
}
