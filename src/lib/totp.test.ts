import { describe, it, expect } from 'vitest'
import { base32Encode, base32Decode, generateSecret, totp, verifyTotp } from './totp'

// RFC-6238-Testseed: ASCII "12345678901234567890" (20 Byte) als Base32.
const SEED = base32Encode(Buffer.from('12345678901234567890'))

describe('Base32', () => {
  it('kodiert/dekodiert verlustfrei', () => {
    const b = Buffer.from('Hallo Welt')
    expect(base32Decode(base32Encode(b)).toString()).toBe('Hallo Welt')
  })
  it('erzeugt den bekannten RFC-Seed', () => {
    expect(SEED).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
  })
})

describe('TOTP (RFC-6238-Testvektoren, SHA1)', () => {
  // 8-stellig laut RFC; die 6-stellige Variante sind die letzten 6 Ziffern.
  const faelle: Array<[number, string, string]> = [
    [59, '94287082', '287082'],
    [1111111109, '07081804', '081804'],
    [1111111111, '14050471', '050471'],
    [1234567890, '89005924', '005924'],
    [2000000000, '69279037', '279037'],
  ]
  for (const [t, acht, sechs] of faelle) {
    it(`T=${t}`, () => {
      expect(totp(SEED, t * 1000, 30, 8)).toBe(acht)
      expect(totp(SEED, t * 1000, 30, 6)).toBe(sechs)
    })
  }
})

describe('verifyTotp', () => {
  it('akzeptiert den aktuellen Code', () => {
    const code = totp(SEED, 59000, 30, 6)
    expect(verifyTotp(SEED, code, 59000)).toBe(true)
  })
  it('akzeptiert den Vorgänger-Code im Zeitfenster (Drift)', () => {
    const prev = totp(SEED, 59000 - 30000, 30, 6)
    expect(verifyTotp(SEED, prev, 59000, 30, 6, 1)).toBe(true)
  })
  it('lehnt einen falschen Code ab', () => {
    expect(verifyTotp(SEED, '000000', 59000)).toBe(false)
  })
})

describe('generateSecret', () => {
  it('liefert ein 32-Zeichen-Base32-Geheimnis (20 Byte)', () => {
    const s = generateSecret()
    expect(s).toMatch(/^[A-Z2-7]{32}$/)
  })
})
