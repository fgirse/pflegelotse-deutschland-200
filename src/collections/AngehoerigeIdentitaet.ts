import type { CollectionConfig } from 'payload'
import { piiFeld } from './piiHooks'

// SÄULE 1 — Kontaktdaten der Angehörigen zu einem Bedarf (PII, verschlüsselt).
// pseudonymId == Bedarf-pseudonymId. Zugriff ist über die Payload-API komplett
// gesperrt: Das Lesen läuft ausschließlich serverseitig über den
// Marktplatz-Service (holeKontakt), der erst NACH der Dienstauswahl und nur an
// genau den gewählten Dienst freigibt (Anti-Leakage /F340/, P6).
const PII_FELDER = ['vorname', 'nachname', 'telefon', 'email', 'adresse'] as const

export const AngehoerigeIdentitaet: CollectionConfig = {
  slug: 'angehoerige_identitaet',
  dbName: 'angehoerige_identitaet',
  admin: { useAsTitle: 'pseudonymId', group: 'Säule 1 (Identität · CSFLE)' },
  access: {
    // Bewusst alles gesperrt — Freigabe nur über den Service (overrideAccess).
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'pseudonymId', type: 'text', required: true, unique: true, index: true },
    // Verknüpfung zum Suchenden-Konto (für „Meine Bedarfe"). Kein PII, daher
    // unverschlüsselt und abfragbar; die Zuordnung Identität↔Konto bleibt in
    // Säule 1. Anonym (ohne Login) eingestellte Bedarfe haben keinen Wert.
    { name: 'ownerUserId', type: 'text', index: true },
    // Einwilligungs-Nachweis (Art. 7 Abs. 1 DSGVO): wann + auf welche Fassung.
    { name: 'einwilligungAt', type: 'date' },
    { name: 'einwilligungVersion', type: 'text' },
    ...PII_FELDER.map(piiFeld),
  ],
}
