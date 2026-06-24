import { createHmac, randomBytes } from 'node:crypto'

// ── TOTP (RFC 6238) — reine Implementierung, ohne externe Abhängigkeit ───
// Wird für die verpflichtende 2FA der Rollen mit Klientendatenzugriff genutzt.

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

// Base32-Kodierung (RFC 4648, ohne Padding) — Format der Authenticator-Apps.
export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(str: string): Buffer {
  const clean = str.replace(/=+$/, '').toUpperCase().replace(/\s/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

// Erzeugt ein zufälliges Geheimnis (Base32) — 20 Byte = 160 Bit (RFC-Empfehlung).
export function generateSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes))
}

// HOTP (RFC 4226): zählerbasiertes Einmalpasswort.
export function hotp(secret: string, counter: number, digits = 6): string {
  const key = base32Decode(secret)
  const buf = Buffer.alloc(8)
  // Zähler als 64-Bit Big-Endian.
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', key).update(buf).digest()
  // Dynamische Trunkierung (RFC 4226 §5.3).
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return (bin % 10 ** digits).toString().padStart(digits, '0')
}

// TOTP (RFC 6238): zeitbasiert, Standard 30-Sekunden-Schritte.
export function totp(secret: string, timeMs = Date.now(), step = 30, digits = 6): string {
  const counter = Math.floor(timeMs / 1000 / step)
  return hotp(secret, counter, digits)
}

// Prüft einen Code gegen ein Zeitfenster (±window Schritte gegen Drift/Latenz).
export function verifyTotp(
  secret: string,
  token: string,
  timeMs = Date.now(),
  step = 30,
  digits = 6,
  window = 1,
): boolean {
  const counter = Math.floor(timeMs / 1000 / step)
  const t = token.trim()
  for (let w = -window; w <= window; w++) {
    if (hotp(secret, counter + w, digits) === t) return true
  }
  return false
}

// otpauth://-URI für Authenticator-Apps (QR oder manuelle Eingabe).
export function otpauthURI(secret: string, account: string, issuer = 'PflegeLotse'): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' })
  return `otpauth://totp/${label}?${params.toString()}`
}
