import type { Db, Document } from 'mongodb'
import { UUID_V4_PATTERN } from '@/lib/pseudonym'

// Serverseitige $jsonSchema-Validatoren für Säule 2. Zweite Verteidigungslinie
// neben dem App-RBAC: MongoDB weist PII-Schreibvorgänge selbst dann ab, wenn
// die Anwendung fehlerhaft wäre.
//
// WICHTIG: Payload speichert Feldnamen in camelCase (pseudonymId, tenantId),
// daher prüft der Validator diese Namen — nicht die snake_case-Form aus dem
// illustrativen Pflichtenheft-Beispiel. Die PII-Blackbox-Felder
// (vorname/nachname/adresse/telefon) heißen ohnehin gleich.

// Ein Feld, das es unter diesem Namen nicht geben darf. `not` über die
// relevanten BSON-Typen: fehlt das Feld, greift die Regel nicht — erlaubt ist
// also nur seine Abwesenheit.
const nichtPii = { not: { bsonType: ['string', 'object', 'array', 'null'] } }

// Feldnamen, unter denen personenbezogene Daten typischerweise landen. Zentral
// gepflegt, damit jede Säule-2-Collection dieselbe Sperre bekommt — eine
// Collection, die nur die Hälfte davon abweist, ist eine offene Flanke.
const PII_FELDER = [
  'vorname',
  'nachname',
  'geburtsdatum',
  'adresse',
  'telefon',
  'email',
  'kvnr',
  'versichertennummer',
] as const

// Die PII-Blackbox als properties-Objekt.
function piiSperren(): Document {
  return Object.fromEntries(PII_FELDER.map((f) => [f, nichtPii]))
}

// Baut einen $jsonSchema-Validator mit PII-Blackbox. Pflichtfelder und der
// Status-Enum unterscheiden sich je Collection (klienten_operativ ist
// mandantengebunden, bedarfe ist marktplatzweit ohne tenantId).
function piiValidator(required: string[], statusEnum: string[]) {
  return {
    $jsonSchema: {
      bsonType: 'object',
      required,
      properties: {
        ...piiSperren(),
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

// Validator für pflegekraft_stamm: verknüpft über pflegekraftId (Kürzel, keine
// UUID), daher eigene Variante. Gleiche PII-Blackbox — Personaldaten bleiben in
// Säule 1; hier nur operatives Profil (Qualifikation/Zeiten).
function kuerzelValidator() {
  return {
    $jsonSchema: {
      bsonType: 'object',
      required: ['tenantId', 'pflegekraftId'],
      properties: {
        ...piiSperren(),
        tenantId: { bsonType: 'string' },
        pflegekraftId: { bsonType: 'string' },
      },
    },
  }
}
const stammValidator = kuerzelValidator()
const abwesenheitValidator = kuerzelValidator()

// Reine PII-Blackbox — ohne Pflichtfelder und ohne Strukturvorgaben.
//
// Die übrigen Säule-2-Collections unterscheiden sich stark im Aufbau (Touren,
// Zahlungen, Audit-Log, Verordnungen …). Ein Validator, der ihre Struktur
// vorschreibt, würde bei jeder Schema-Erweiterung brechen und wäre damit ein
// Risiko statt eines Schutzes. Diese Variante prüft deshalb ausschließlich die
// Invariante, die für alle gilt: hier darf niemals PII landen.
function blackboxValidator(zusatz?: Document) {
  return {
    $jsonSchema: {
      bsonType: 'object',
      properties: { ...piiSperren(), ...zusatz },
    },
  }
}

// Touren und Stammtouren tragen ihre Klientenbezüge in einem einsaetze-Array.
// Ohne diese verschachtelte Sperre wäre die Blackbox trivial zu umgehen: ein
// Name in einsaetze[0].vorname bliebe unbemerkt.
const einsatzSperre: Document = {
  einsaetze: {
    bsonType: 'array',
    items: { bsonType: 'object', properties: piiSperren() },
  },
}

// Säule-2-Collections mit reiner PII-Blackbox. Bewusst NICHT dabei:
// leistungskatalog und abrechnungskonfiguration — das sind Mandanten-
// Stammdaten ohne Personenbezug, deren DATEV-Kopfdaten legitim eine
// Firmenanschrift enthalten dürfen.
const BLACKBOX_COLLECTIONS = [
  'leistungsnachweise',
  'verordnungen',
  'praeventionsempfehlungen',
  'angebote',
  'abos',
  'zahlungen',
  'klienten_keys',
  'gdpr_audit_log',
] as const

// Wendet einen Validator auf eine Collection an (createCollection oder
// collMod). Idempotent.
async function applyPiiValidator(
  db: Db,
  name: string,
  validator: Document,
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
  // PII-Sperre für die pseudonymen Säule-2-Collections.
  await applyPiiValidator(db, 'klienten_operativ', operativValidator)
  await applyPiiValidator(db, 'bedarfe', bedarfValidator)
  await applyPiiValidator(db, 'pflegekraft_stamm', stammValidator)
  // Ein Stammprofil je Pflegekraft und Mandant.
  await db
    .collection('pflegekraft_stamm')
    .createIndex({ tenantId: 1, pflegekraftId: 1 }, { unique: true })

  await applyPiiValidator(db, 'abwesenheiten', abwesenheitValidator)
  // Abwesenheiten je Pflegekraft (mehrere Zeiträume) — kein Unique-Index.
  await db.collection('abwesenheiten').createIndex({ tenantId: 1, pflegekraftId: 1 })

  // Touren tragen Klientenbezüge in einsaetze[] — Sperre reicht dort hinein.
  await applyPiiValidator(db, 'touren', blackboxValidator(einsatzSperre))
  await applyPiiValidator(db, 'stammtouren', blackboxValidator(einsatzSperre))

  // Übrige Säule-2-Collections: reine PII-Blackbox.
  for (const name of BLACKBOX_COLLECTIONS) {
    await applyPiiValidator(db, name, blackboxValidator())
  }

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
