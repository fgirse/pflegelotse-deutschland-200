import { getPayload } from 'payload'
import config from '@payload-config'

// Gibt eine initialisierte Payload-Instanz für die Local API zurück.
// Über Hot-Reloads hinweg zwischengespeichert. WICHTIG: eigener Global-Key
// (_pflegePayload) — Payload selbst belegt globalThis._payload mit einer
// anders geformten Struktur; den dürfen wir nicht versehentlich abgreifen.
const globalForPayload = globalThis as unknown as {
  _pflegePayload?: Awaited<ReturnType<typeof getPayload>>
}

export async function payloadClient() {
  if (!globalForPayload._pflegePayload) {
    globalForPayload._pflegePayload = await getPayload({ config })
  }
  return globalForPayload._pflegePayload
}
