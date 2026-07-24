import type { CollectionConfig } from 'payload'
import { tenantScoped, istDienstMitarbeiter, klientenSchreibAccess } from './access'

// SÄULE 2 — Stammtouren: Vorlagen wiederkehrender Touren (Pflichtenheft 5.2.2).
// Aus ihnen wird je Woche der Rahmenplan (konkrete Touren) generiert. Wie die
// Touren-Collection enthält sie nur pseudonyme Referenzen (pseudonymId), keine PII.
export const Stammtouren: CollectionConfig = {
  slug: 'stammtouren',
  dbName: 'stammtouren', // keine Pluralisierung
  admin: { useAsTitle: 'pflegekraftId', group: 'Säule 2 (operativ)' },
  access: {
    read: tenantScoped,
    create: klientenSchreibAccess,
    update: klientenSchreibAccess,
    delete: klientenSchreibAccess,
  },
  fields: [
    { name: 'tenantId', type: 'text', required: true, index: true },
    { name: 'pflegekraftId', type: 'text', required: true },
    { name: 'pflegekraftQualifikation', type: 'json', defaultValue: [] },
    { name: 'pflegekraftGeschlecht', type: 'select', options: ['m', 'w', 'd'] },
    {
      name: 'start',
      type: 'group',
      fields: [
        { name: 'lat', type: 'number', required: true },
        { name: 'lng', type: 'number', required: true },
      ],
    },
    {
      name: 'ende',
      type: 'group',
      fields: [
        { name: 'lat', type: 'number' },
        { name: 'lng', type: 'number' },
      ],
    },
    { name: 'startZeit', type: 'number', defaultValue: 480 },
    { name: 'verfuegbarBis', type: 'number' },
    { name: 'maxEinsaetze', type: 'number' },
    // Wochentage, an denen die Tour läuft (ISO 1..7, Mo=1). Pflicht: mind. einer.
    { name: 'wochentage', type: 'json', required: true },
    { name: 'aktivAb', type: 'text' }, // YYYY-MM-DD, optional
    { name: 'aktivBis', type: 'text' },
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
        { name: 'dauerMin', type: 'number', defaultValue: 30 },
        { name: 'grundzeitMin', type: 'number', defaultValue: 0 },
        { name: 'qualifikation', type: 'json', defaultValue: [] },
        // Eigene Wochentage des Einsatzes; leer = die der Stammtour.
        { name: 'wochentage', type: 'json' },
      ],
    },
  ],
}

// Lesehilfe-Export für die API-Schicht.
export const stammtourenLeseAccess = { read: tenantScoped, list: istDienstMitarbeiter }
