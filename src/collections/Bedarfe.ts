import type { CollectionConfig } from 'payload'
import { istDienstMitarbeiter } from './access'

// SÄULE 2 — Marktplatz-Bedarfe (pseudonym, marktplatzweit). NIEMALS PII.
// Anders als Klienten sind Bedarfe NICHT einem Dienst-Mandanten zugeordnet:
// ein Bedarf wird allen passenden Diensten gezeigt (/F310/). Schreiben läuft
// serverseitig über die v1-API (overrideAccess); Angehörige sind nicht eingeloggt.
export const Bedarfe: CollectionConfig = {
  slug: 'bedarfe',
  dbName: 'bedarfe', // keine Pluralisierung — Validator liegt auf „bedarfe"
  admin: { useAsTitle: 'pseudonymId', group: 'Säule 2 (operativ)' },
  access: {
    read: istDienstMitarbeiter, // Dienste sehen passende Bedarfe (anonym)
    create: () => false, // nur Server (overrideAccess)
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'pseudonymId', type: 'text', required: true, unique: true, index: true },
    {
      name: 'geo',
      type: 'group',
      fields: [
        { name: 'lat', type: 'number', required: true },
        { name: 'lng', type: 'number', required: true },
      ],
    },
    { name: 'pflegegrad', type: 'number', min: 1, max: 5 },
    { name: 'leistungen', type: 'json', defaultValue: [] },
    { name: 'qualifikation', type: 'json', defaultValue: [] },
    // Kostenträger: Art (gesetzlich/privat) + konkrete Kasse. Operativ relevant
    // für die Abrechnung des Dienstes; kein PII (grobe Kategorie, kein Identifikator).
    {
      name: 'kostentraegerArt',
      type: 'select',
      options: ['gesetzlich', 'privat'],
      index: true,
    },
    { name: 'krankenversicherer', type: 'text' },
    {
      name: 'zeitfenster',
      type: 'group',
      fields: [
        { name: 'von', type: 'number', required: true },
        { name: 'bis', type: 'number', required: true },
      ],
    },
    { name: 'dauerMin', type: 'number', defaultValue: 30 },
    { name: 'express', type: 'checkbox', defaultValue: false },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'offen',
      options: ['offen', 'in_bearbeitung', 'vergeben', 'abgesagt'],
      index: true,
    },
    // Mandanten, an die der Bedarf ausgespielt wurde (Fan-out-Ergebnis).
    { name: 'matchingTenants', type: 'json', defaultValue: [] },
    // Gewählter Dienst — gesetzt bei Auswahl; gibt Kontakt frei (/F340/).
    { name: 'selectedTenantId', type: 'text', index: true },
    // 24h-Rückmeldung (/F400/): Frist bis zur automatischen Absage.
    { name: 'deadlineAt', type: 'date', index: true },
    // Zeitpunkt des ersten Angebots (SLA: Zeit bis erste Reaktion /F440/).
    { name: 'firstResponseAt', type: 'date' },
    // Gesetzt, wenn der gewonnene Bedarf als Klient in die Tourenplanung
    // übernommen wurde (verhindert Doppel-Übernahme).
    { name: 'uebernommenAt', type: 'date' },
  ],
}
