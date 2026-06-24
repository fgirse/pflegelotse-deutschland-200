import { ClientEncryption, Binary } from 'mongodb'
import { getMongo } from '@/db/mongo'
import { env } from '@/lib/env'
import type { FieldEncryptor } from '@/lib/encryption'

// ── CSFLE-Adapter (echte MongoDB Client-Side Field Level Encryption) ─────
// Nutzt explizite Verschlüsselung (ClientEncryption) — kommt ohne mongocryptd/
// Enterprise aus. Pro Klient ein Data-Encryption-Key im __keyVault (keyAltName =
// pseudonym_id). Das Löschen dieses Keys ist der Crypto-Shredding-Hebel (Art. 17).
//
// KMS: 'local' (Dev, 96-Byte-Masterkey aus der Umgebung) oder 'aws' (Prod, CMK).
// Der aufrufende Code (Collection-Hooks) sieht nur den FieldEncryptor-Port und
// ändert sich nicht.

const ALGO = 'AEAD_AES_256_CBC_HMAC_SHA_512-Random' // Zufalls-IV, für nicht-abgefragte Felder

type KmsProviders = ConstructorParameters<typeof ClientEncryption>[1]['kmsProviders']

function kmsConfig(): { providers: KmsProviders; masterKey?: Record<string, string> } {
  const provider = env.CSFLE_KMS_PROVIDER ?? 'local'
  if (provider === 'aws') {
    return {
      providers: {
        aws: {
          accessKeyId: env.AWS_ACCESS_KEY_ID ?? '',
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? '',
        },
      },
      // CMK, unter dem die DEKs umschlossen werden.
      masterKey: { region: env.CSFLE_AWS_KEY_REGION ?? '', key: env.CSFLE_AWS_KEY_ARN ?? '' },
    }
  }
  // local: 96-Byte-Schlüssel (Base64).
  const key = Buffer.from(env.CSFLE_LOCAL_MASTER_KEY ?? '', 'base64')
  if (key.length !== 96) {
    throw new Error('CSFLE_LOCAL_MASTER_KEY muss 96 Byte (Base64) lang sein.')
  }
  return { providers: { local: { key } } }
}

export class CsfleEncryptor implements FieldEncryptor {
  private ce?: ClientEncryption
  private provider = env.CSFLE_KMS_PROVIDER ?? 'local'
  private masterKey?: Record<string, string>

  // Lazy: ClientEncryption an den geteilten MongoClient binden, Key-Vault-Index
  // sicherstellen (eindeutige keyAltNames).
  private async cipher(): Promise<ClientEncryption> {
    if (this.ce) return this.ce
    const client = await getMongo()
    const dbName = client.db().databaseName
    const { providers, masterKey } = kmsConfig()
    this.masterKey = masterKey
    // Empfohlener eindeutiger Partial-Index auf keyAltNames.
    await client
      .db(dbName)
      .collection('__keyVault')
      .createIndex(
        { keyAltNames: 1 },
        { unique: true, partialFilterExpression: { keyAltNames: { $exists: true } } },
      )
      .catch(() => {})
    this.ce = new ClientEncryption(client, {
      keyVaultNamespace: `${dbName}.__keyVault`,
      kmsProviders: providers,
    })
    return this.ce
  }

  // Stellt den Data-Key des Klienten sicher (idempotent, race-fest über den
  // Unique-Index auf keyAltNames).
  private async ensureKey(ce: ClientEncryption, pseudonymId: string): Promise<void> {
    const vorhanden = await ce.getKeyByAltName(pseudonymId)
    if (vorhanden) return
    try {
      await ce.createDataKey(this.provider, {
        keyAltNames: [pseudonymId],
        ...(this.masterKey ? { masterKey: this.masterKey } : {}),
      })
    } catch {
      // Parallel angelegt → existiert jetzt; ignorieren.
    }
  }

  async encrypt(plaintext: string, pseudonymId: string): Promise<string> {
    const ce = await this.cipher()
    await this.ensureKey(ce, pseudonymId)
    const bin = await ce.encrypt(plaintext, { keyAltName: pseudonymId, algorithm: ALGO })
    // Als Base64 des Binärwerts ablegen (Payload-Feld ist text).
    return Buffer.from(bin.buffer).toString('base64')
  }

  async decrypt(ciphertext: string, _pseudonymId: string): Promise<string | null> {
    const ce = await this.cipher()
    try {
      const bin = new Binary(Buffer.from(ciphertext, 'base64'), Binary.SUBTYPE_ENCRYPTED)
      const val = await ce.decrypt(bin)
      return typeof val === 'string' ? val : String(val)
    } catch {
      // Key crypto-geshreddet oder Wert unlesbar → null.
      return null
    }
  }

  // Crypto-Shredding (Art. 17): Data-Key des Klienten aus dem Vault löschen.
  async shred(pseudonymId: string): Promise<void> {
    const ce = await this.cipher()
    const key = await ce.getKeyByAltName(pseudonymId)
    if (key?._id) await ce.deleteKey(key._id)
  }
}
