import { withPayload } from '@payloadcms/next/withPayload'
import createNextIntlPlugin from 'next-intl/plugin'

// next-intl: verweist auf die Request-Konfiguration der Lokalisierung
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Das native CSFLE-Addon (mongocrypt.node) darf nicht gebündelt werden —
  // serverseitig zur Laufzeit laden statt von webpack auflösen lassen.
  serverExternalPackages: ['mongodb-client-encryption'],
}

// Reihenfolge: erst next-intl, dann Payload umschließen
export default withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false })
