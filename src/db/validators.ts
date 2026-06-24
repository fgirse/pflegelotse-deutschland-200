import type { Db } from 'mongodb'
import { UUID_V4_PATTERN } from '@/lib/pseudonym'

// Serverseitiger $jsonSchema-Validator für Säule 2 (klienten_operativ).
// Zweite Verteidigungslinie neben dem App-RBAC: MongoDB weist PII-Schreib-
// vorgänge selbst dann ab, wenn die Anwendung fehlerhaft wäre.
//
// WICHTIG: Payload speichert Feldnamen in camelCase (pseudonymId, tenantId),
// daher prüft der Validator diese Namen — nicht die snake_case-Form aus dem
// illustrativen Pflichtenheft-Beispiel. Die PII-Blackbox-Felder
// (vorname/nachname/adresse/telefon) heißen ohnehin gleich.
// Baut einen $jsonSchema-Validator mit PII-Blackbox. Pflichtfelder und der
// Status-Enum unterscheiden sich je Collection (klienten_operativ ist
// mandantengebunden, bedarfe ist marktplatzweit ohne tenantId).
function piiValidator(required: string[], statusEnum: string[]) {
  return {
    $jsonSchema: {
      bsonType: 'object',
      required,
      properties: {
        pseudonymId: {
          bsonType: 'string',
          pattern: UUID_V4_PATTERN.source,
          description: 'Muss eine gültige kryptografische UUIDv4 sein.',
        },
        tenantId: { bsonType: 'string' },
        geo: {
          bsonType: 'object',
          required: ['lat', 'lng'],
          properties: {
            lat: { bsonType: ['double', 'int'] },
            lng: { bsonType: ['double', 'int'] },
          },
        },
        // Zahlentypen tolerant (Mongoose schreibt Zahlen als double).
        pflegegrad: { bsonType: ['int', 'double'], minimum: 1, maximum: 5 },
        status: { enum: statusEnum },
        // PII-BLACKBOX: identifizierende Felder werden serverseitig abgewiesen.
        vorname: { not: { bsonType: ['string', 'object', 'array', 'null'] } },
        nachname: { not: { bsonType: ['string', 'object', 'array', 'null'] } },
        adresse: { not: { bsonType: ['string', 'object', 'array', 'null'] } },
        telefon: { not: { bsonType: ['string', 'object', 'array', 'null'] } },
      },
    },
  }
}

const operativValidator = piiValidator(
  ['pseudonymId', 'tenantId', 'geo', 'status'],
  ['aktiv', 'pausiert', 'beendet'],
)
const bedarfValidator = piiValidator(
  ['pseudonymId', 'geo', 'status'],
  ['offen', 'in_bearbeitung', 'vergeben', 'abgesagt'],
)

// Wendet einen Validator auf eine Collection an (createCollection oder
// collMod). Idempotent.
async function applyPiiValidator(
  db: Db,
  name: string,
  validator: ReturnType<typeof piiValidator>,
): Promise<void> {
  const existing = await db.listCollections({ name }).toArray()
  if (existing.length === 0) {
    await db.createCollection(name, {
      validator,
      validationLevel: 'strict',
      validationAction: 'error',
    })
  } else {
    await db.command({
      collMod: name,
      validator,
      validationLevel: 'strict',
      validationAction: 'error',
    })
  }
}

// Legt die Validatoren an (oder aktualisiert sie) und stellt die Indizes sicher.
// Idempotent — kann beliebig oft laufen.
export async function applyValidators(db: Db): Promise<void> {
  // PII-Sperre für beide pseudonymen Säule-2-Collections.
  await applyPiiValidator(db, 'klienten_operativ', operativValidator)
  await applyPiiValidator(db, 'bedarfe', bedarfValidator)

  // Indizes (/L500/): mandantengescopte Lookups + Geo-Abfragen.
  const operativ = db.collection('klienten_operativ')
  await operativ.createIndex({ tenantId: 1, pseudonymId: 1 })
  // 2dsphere erwartet GeoJSON; unser geo ist {lat,lng}. Für spätere
  // $near-Abfragen ergänzen wir ein abgeleitetes GeoJSON-Feld — hier zunächst
  // ein einfacher Index auf die Koordinaten.
  await operativ.createIndex({ 'geo.lat': 1, 'geo.lng': 1 })

  const touren = db.collection('touren')
  await touren.createIndex({ tenantId: 1, datum: 1 })

  // Schlüsselspeicher: pseudonym_id eindeutig.
  const keys = db.collection('klienten_keys')
  await keys.createIndex({ pseudonym_id: 1 }, { unique: true })
}
