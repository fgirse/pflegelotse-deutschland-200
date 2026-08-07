import type { CollectionConfig } from 'payload'
import { tenantScoped, klientenSchreibAccess } from './access'

// Abrechnungs-Stammdaten je Mandant (§8.3): Preise je Leistungskomplex und die
// DATEV-Kopfdaten. Der Dienst pflegt sie in /admin. Operativ, kein PII.
export const Abrechnungskonfiguration: CollectionConfig = {
  slug: 'abrechnungskonfiguration',
  dbName: 'abrechnungskonfiguration',
  admin: { useAsTitle: 'tenantId', group: 'Abrechnung' },
  access: {
    read: tenantScoped,
    create: klientenSchreibAccess,
    update: klientenSchreibAccess,
    delete: () => false,
  },
  fields: [
    { name: 'tenantId', type: 'text', required: true, unique: true, index: true },
    // Preise je Leistungskomplex-Code in Euro, z. B. { "LK01": 25.5, "LK02": 18 }.
    { name: 'preise', type: 'json', defaultValue: {} },
    // Abweichende Privatsätze (PKV) je Code. Fehlt ein Code, gilt der GKV-Satz.
    { name: 'preisePrivat', type: 'json', defaultValue: {} },
    // ── DATEV-Kopfdaten (EXTF-Buchungsstapel) ──
    { name: 'beraterNr', type: 'text' }, // DATEV-Beraternummer
    { name: 'mandantenNr', type: 'text' }, // DATEV-Mandantennummer
    { name: 'wjBeginn', type: 'text' }, // Wirtschaftsjahr-Beginn, YYYYMMDD
    { name: 'sachkontenlaenge', type: 'number', defaultValue: 4 },
    { name: 'erloesKonto', type: 'text' }, // Erlöskonto (Haben)
    { name: 'debitorKonto', type: 'text' }, // Sammel-Debitor (Soll)
  ],
}
