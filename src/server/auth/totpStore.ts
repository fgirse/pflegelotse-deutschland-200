import { payloadClient } from '@/server/payloadClient'

// Liest das (entschlüsselte) TOTP-Geheimnis eines Nutzers. Nur serverseitig
// (overrideAccess umgeht die Feld-Sperre read:false).
export async function ladeTotpSecret(
  userId: string,
): Promise<{ secret?: string; enabled: boolean } | null> {
  const payload = await payloadClient()
  try {
    const u = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
    return {
      secret: (u as { totpSecret?: string }).totpSecret,
      enabled: Boolean((u as { totpEnabled?: boolean }).totpEnabled),
    }
  } catch {
    return null
  }
}
