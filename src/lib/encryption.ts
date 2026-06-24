import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from './env'

// ── Encryption-Port (Ports & Adapters) ───────────────────────────────────
// Die Anwendung kennt nur dieses Interface. Lokal füllt es der
// AppCryptoEncryptor (AES-256-GCM + pro-Klient-Schlüssel); in Produktion
// wird derselbe Port von einem Atlas-CSFLE-Adapter bedient — ohne dass sich
// die aufrufende Logik ändert.
export interface FieldEncryptor {
  // Verschlüsselt Klartext für genau einen Klienten (pseudonym_id).
  encrypt(plaintext: string, pseudonymId: string): Promise<string>
  // Entschlüsselt. Gibt null zurück, wenn der Klientenschlüssel
  // crypto-geshreddet wurde (Art. 17) — die Daten sind dann unlesbar.
  decrypt(ciphertext: string, pseudonymId: string): Promise<string | null>
  // Crypto-Shredding: vernichtet den klientenspezifischen Schlüssel.
  // Danach sind alle mit ihm verschlüsselten Felder unumkehrbar unlesbar,
  // auch in Backups.
  shred(pseudonymId: string): Promise<void>
}

// ── Schlüsselspeicher ─────────────────────────────────────────────────────
// Hält die pro-Klient-Data-Encryption-Keys (DEK), selbst wieder unter dem
// Master-Key umschlossen (Envelope Encryption). Das Löschen eines DEK ist
// der Crypto-Shredding-Hebel.
export interface KeyStore {
  getWrappedDek(pseudonymId: string): Promise<string | null>
  // Speichert NUR, wenn noch kein Schlüssel existiert (insert-if-absent).
  // Entscheidend gegen Races: verschlüsseln mehrere Feld-Hooks denselben
  // Klienten gleichzeitig, darf nur EIN DEK persistiert werden.
  putWrappedDekIfAbsent(pseudonymId: string, wrapped: string): Promise<void>
  deleteDek(pseudonymId: string): Promise<void>
}

const ALGO = 'aes-256-gcm'

// Master-Key aus der Umgebung (Base64, 32 Byte). In Prod kommt er aus KMS/Vault.
function masterKey(): Buffer {
  const key = Buffer.from(env.ENCRYPTION_MASTER_KEY, 'base64')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_MASTER_KEY muss 32 Byte (Base64) lang sein.')
  }
  return key
}

// AES-256-GCM: Ergebnis als "iv:tag:ciphertext" (alles Base64).
function gcmEncrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join(':')
}

function gcmDecrypt(payload: string, key: Buffer): string {
  const [ivB64, tagB64, dataB64] = payload.split(':')
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ])
  return dec.toString('utf8')
}

// Verschlüsselt ein Geheimnis direkt mit dem Master-Key (kein pro-Klient-DEK).
// Für serverseitige Secrets wie das TOTP-Seed der Nutzer.
export function sealSecret(plaintext: string): string {
  return gcmEncrypt(plaintext, masterKey())
}
export function openSecret(ciphertext: string): string {
  return gcmDecrypt(ciphertext, masterKey())
}

// Lokaler Adapter: AES-256-GCM mit pro-Klient-DEK, DEK umschlossen vom Master-Key.
export class AppCryptoEncryptor implements FieldEncryptor {
  constructor(private readonly keys: KeyStore) {}

  // Holt den DEK des Klienten oder erzeugt ihn atomar. Konvergiert auch bei
  // gleichzeitigen Aufrufen auf EINEN persistierten Schlüssel: Wir schreiben
  // insert-if-absent und lesen anschließend den tatsächlich gespeicherten
  // (Gewinner-)DEK zurück — den nutzen dann alle Aufrufer.
  private async dekFor(pseudonymId: string): Promise<Buffer> {
    const wrapped = await this.keys.getWrappedDek(pseudonymId)
    if (wrapped) return Buffer.from(gcmDecrypt(wrapped, masterKey()), 'base64')

    const kandidat = gcmEncrypt(randomBytes(32).toString('base64'), masterKey())
    await this.keys.putWrappedDekIfAbsent(pseudonymId, kandidat)
    // Verbindlich den persistierten Schlüssel zurücklesen.
    const persistiert = await this.keys.getWrappedDek(pseudonymId)
    if (!persistiert) throw new Error('DEK konnte nicht gespeichert werden')
    return Buffer.from(gcmDecrypt(persistiert, masterKey()), 'base64')
  }

  async encrypt(plaintext: string, pseudonymId: string): Promise<string> {
    return gcmEncrypt(plaintext, await this.dekFor(pseudonymId))
  }

  async decrypt(ciphertext: string, pseudonymId: string): Promise<string | null> {
    const wrapped = await this.keys.getWrappedDek(pseudonymId)
    // Kein DEK mehr → geshreddet → bewusst unlesbar.
    if (!wrapped) return null
    const dek = Buffer.from(gcmDecrypt(wrapped, masterKey()), 'base64')
    return gcmDecrypt(ciphertext, dek)
  }

  async shred(pseudonymId: string): Promise<void> {
    await this.keys.deleteDek(pseudonymId)
  }
}
