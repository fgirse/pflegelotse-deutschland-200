import type { CollectionConfig } from 'payload'
import { tenantScoped } from './access'

// SÄULE 2 — rechtssicherer Leistungsnachweis (Pflichtenheft 5.4). WORM-Journal:
// je bestätigtem Besuch ein unveränderbarer, hash-verketteter Eintrag. Enthält
// nur pseudonyme Referenzen (pseudonymId), NIEMALS PII — der Klarname kommt erst
// bei der Nachweis-Erzeugung aus Säule 1 hinzu (nur zur Darstellung).
export const Leistungsnachweise: CollectionConfig = {
  slug: 'leistungsnachweise',
  dbName: 'leistungsnachweise', // keine Pluralisierung
  admin: { useAsTitle: 'pseudonymId', group: 'Säule 2 (operativ)' },
  access: {
    read: tenantScoped,
    create: () => true, // nur Server (overrideAccess) schreibt
    update: () => false, // append-only (revisionssicher)
    delete: () => false, // append-only (revisionssicher)
  },
  fields: [
    { name: 'tenantId', type: 'text', required: true, index: true },
    { name: 'pseudonymId', type: 'text', required: true, index: true },
    { name: 'datum', type: 'text', required: true }, // ISO YYYY-MM-DD
    { name: 'tourId', type: 'text', required: true },
    { name: 'erbrachteLeistungen', type: 'json', defaultValue: [] }, // Leistungskomplex-Codes
    { name: 'istAnkunft', type: 'number' },
    { name: 'istAbfahrt', type: 'number' },
    { name: 'bestaetigtAm', type: 'text', required: true }, // ISO-Zeitstempel
    { name: 'bestaetigtVon', type: 'text', required: true }, // Pflegekraft-Kennung
    // Hash-Kette (revisionssicher): prevHash zeigt auf den Vorgänger.
    { name: 'prevHash', type: 'text', required: true, index: true },
    { name: 'hash', type: 'text', required: true, unique: true },
    { name: 'pepperVersion', type: 'text', required: true },
  ],
}
