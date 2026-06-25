import { withPayload } from '@payloadcms/next/withPayload'
import { withSentryConfig } from '@sentry/nextjs'
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
const baseConfig = withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false })

// Sentry als äußerste Schicht. Der Source-Map-Upload läuft nur, wenn
// SENTRY_AUTH_TOKEN (+ org/project) gesetzt sind — sonst wird er still
// übersprungen, der Build funktioniert also auch ohne Sentry-Konto.
export default withSentryConfig(baseConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
})
