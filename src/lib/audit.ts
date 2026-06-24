import { createHmac } from 'node:crypto'
import { env } from './env'

// HMAC-Hash für das WORM-Audit-Log. Der Pepper bleibt geheim (in Prod im
// Vault Transit); ohne ihn ist der gespeicherte Hash wertlos. pepper_version
// erlaubt Schlüsselrotation, ohne alte Hashes unverifizierbar zu machen.
export function identityHash(kennung: string): { hash: string; pepperVersion: string } {
  const hash = createHmac('sha256', env.AUDIT_PEPPER).update(kennung).digest('hex')
  return { hash, pepperVersion: env.AUDIT_PEPPER_VERSION }
}
