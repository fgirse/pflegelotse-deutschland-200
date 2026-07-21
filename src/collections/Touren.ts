import type { CollectionConfig } from 'payload'
import { tenantScoped, istDienstMitarbeiter, klientenSchreibAccess } from './access'

// SÄULE 2 — Touren: eine Pflegekraft, ein Tag, eine Einsatzfolge.
// Enthält ausschließlich pseudonymisierte Referenzen (pseudonym_id), keine PII.
export const Touren: CollectionConfig = {
  slug: 'touren',
  dbName: 'touren', // keine Pluralisierung
  admin: { useAsTitle: 'id', group: 'Säule 2 (operativ)' },
  access: {
    read: tenantScoped,
    create: klientenSchreibAccess,
    update: klientenSchreibAccess,
    delete: klientenSchreibAccess,
  },
  fields: [
    { name: 'tenantId', type: 'text', required: true, index: true },
    { name: 'datum', type: 'text', required: true }, // ISO YYYY-MM-DD
    { name: 'pflegekraftId', type: 'text', required: true },
    { name: 'pflegekraftQualifikation', type: 'json', defaultValue: [] },
    {
      name: 'start',
      type: 'group',
      fields: [
        { name: 'lat', type: 'number', required: true },
        { name: 'lng', type: 'number', required: true },
      ],
    },
    { name: 'startZeit', type: 'number', defaultValue: 480 }, // 08:00
    {
      name: 'einsaetze',
      type: 'array',
      fields: [
        { name: 'pseudonymId', type: 'text', required: true },
        {
          name: 'geo',
          type: 'group',
          fields: [
            { name: 'lat', type: 'number', required: true },
            { name: 'lng', type: 'number', required: true },
          ],
        },
        {
          name: 'zeitfenster',
          type: 'group',
          fields: [
            { name: 'von', type: 'number', required: true },
            { name: 'bis', type: 'number', required: true },
          ],
        },
        { name: 'dauerMin', type: 'number', defaultValue: 30 }, // reine Leistungszeit
        // Hausbesuchsgrundzeit je Besuch (Pflichtenheft 5.1.3), separat von dauerMin.
        { name: 'grundzeitMin', type: 'number', defaultValue: 0 },
        { name: 'qualifikation', type: 'json', defaultValue: [] },
        { name: 'ankunft', type: 'number' }, // geplante Ankunft (Min seit Mitternacht)
        { name: 'probe', type: 'checkbox', defaultValue: false }, // unverbindliche Probe-Einplanung
      ],
    },
  ],
}

// Lesehilfe-Export für API-Schicht.
export const tourenLeseAccess = { read: tenantScoped, list: istDienstMitarbeiter }
