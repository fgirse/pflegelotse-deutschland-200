import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'

// Signiertes Kurzzeit-Cookie, das eine erfolgreiche 2FA-Prüfung bescheinigt.
// Inhalt: userId.expMs.HMAC(PAYLOAD_SECRET). Kein Geheimnis im Klartext.
export const COOKIE_2FA = 'pl_2fa'
export const TWOFA_TTL_MS = 12 * 60 * 60 * 1000 // 12 Stunden

function sign(data: string): string {
  return createHmac('sha256', env.PAYLOAD_SECRET).update(data).digest('hex')
}

export function sign2fa(userId: string, nowMs = Date.now()): string {
  const exp = nowMs + TWOFA_TTL_MS
  const data = `${userId}.${exp}`
  return `${data}.${sign(data)}`
}

// Prüft Signatur, Ablauf und Nutzerbindung des 2FA-Cookies.
export function verify2fa(token: string | undefined, userId: string, nowMs = Date.now()): boolean {
  if (!token) return false
  const teile = token.split('.')
  if (teile.length !== 3) return false
  const [uid, expStr, sig] = teile
  if (uid !== userId) return false
  if (Number(expStr) < nowMs) return false
  const erwartet = sign(`${uid}.${expStr}`)
  const a = Buffer.from(sig)
  const b = Buffer.from(erwartet)
  return a.length === b.length && timingSafeEqual(a, b)
}
