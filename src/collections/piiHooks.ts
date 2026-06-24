import type { Field, FieldHook } from 'payload'
import { getEncryptor } from '@/server/identity/encryptionService'

// Wiederverwendbare Feld-Hooks für Säule-1-PII: verschlüsseln beim Schreiben,
// entschlüsseln beim Lesen. Der Schlüssel ist pro Klient/Bedarf (pseudonymId).
// Nach Crypto-Shredding (Schlüssel weg) liefert das Lesen null.
const encryptHook: FieldHook = async ({ value, data }) => {
  if (value == null || value === '') return value
  const pseudonymId = data?.pseudonymId
  if (!pseudonymId) return value
  return getEncryptor().encrypt(String(value), pseudonymId)
}

const decryptHook: FieldHook = async ({ value, data }) => {
  if (value == null || value === '') return value
  const pseudonymId = data?.pseudonymId
  if (!pseudonymId) return value
  return getEncryptor().decrypt(String(value), pseudonymId)
}

// Erzeugt ein verschlüsseltes Textfeld.
export function piiFeld(name: string): Field {
  return {
    name,
    type: 'text',
    hooks: { beforeChange: [encryptHook], afterRead: [decryptHook] },
  }
}
