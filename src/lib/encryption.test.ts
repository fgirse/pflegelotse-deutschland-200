import { describe, it, expect } from 'vitest'
import { AppCryptoEncryptor, type KeyStore } from './encryption'

// In-Memory-Schlüsselspeicher für den Test (kein MongoDB nötig).
class MemKeyStore implements KeyStore {
  private store = new Map<string, string>()
  async getWrappedDek(id: string) {
    return this.store.get(id) ?? null
  }
  async putWrappedDekIfAbsent(id: string, wrapped: string) {
    if (!this.store.has(id)) this.store.set(id, wrapped)
  }
  async deleteDek(id: string) {
    this.store.delete(id)
  }
}

const PID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

describe('Encryption-Port (AppCryptoEncryptor)', () => {
  it('verschlüsselt und entschlüsselt verlustfrei', async () => {
    const enc = new AppCryptoEncryptor(new MemKeyStore())
    const ciph = await enc.encrypt('Anna Bauer', PID)
    expect(ciph).not.toContain('Anna')
    expect(await enc.decrypt(ciph, PID)).toBe('Anna Bauer')
  })

  it('Crypto-Shredding macht Daten unumkehrbar unlesbar', async () => {
    const enc = new AppCryptoEncryptor(new MemKeyStore())
    const ciph = await enc.encrypt('Habsburgerstr. 1', PID)
    await enc.shred(PID)
    // Schlüssel vernichtet → null, auch wenn der Chiffretext noch existiert.
    expect(await enc.decrypt(ciph, PID)).toBeNull()
  })

  it('nutzt getrennte Schlüssel je Klient', async () => {
    const store = new MemKeyStore()
    const enc = new AppCryptoEncryptor(store)
    const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const ciph = await enc.encrypt('geheim', PID)
    // Das Shredding eines anderen Klienten lässt diesen unberührt.
    await enc.shred(other)
    expect(await enc.decrypt(ciph, PID)).toBe('geheim')
  })
})
