import { AppCryptoEncryptor, type FieldEncryptor } from '@/lib/encryption'
import { MongoKeyStore } from '@/db/keystore'
import { CsfleEncryptor } from './csfleEncryptor'
import { env } from '@/lib/env'

// Singleton-Encryptor für Säule 1 (Encryption-Port). Auswahl per Konfiguration:
// - CSFLE_ENABLED=true → echte MongoDB-CSFLE (KMS, __keyVault).
// - sonst → lokaler AES-256-GCM-Adapter mit MongoDB-Schlüsselspeicher (Dev).
// Der Aufrufer (Collection-Hooks) sieht in beiden Fällen nur den Port.
let instance: FieldEncryptor | undefined

export function getEncryptor(): FieldEncryptor {
  if (!instance) {
    instance =
      env.CSFLE_ENABLED === 'true'
        ? new CsfleEncryptor()
        : new AppCryptoEncryptor(new MongoKeyStore())
  }
  return instance
}
