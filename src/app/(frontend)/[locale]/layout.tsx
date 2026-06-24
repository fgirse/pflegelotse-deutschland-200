import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import { setRequestLocale, getMessages } from 'next-intl/server'
import { routing } from '@/i18n/routing'

export const metadata: Metadata = {
  title: 'PflegeLotse — Tourenoptimierung',
  description: 'Tourenoptimierung für ambulante Pflegedienste',
}

// Eigenes Root-Layout der lokalisierten Frontend-Site (getrennt vom
// Payload-Admin-Layout). Setzt die HTML-Sprache passend zur Locale.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound()

  // Aktiviert statisches Rendering für diese Locale.
  setRequestLocale(locale)

  // Messages an Client-Komponenten durchreichen (sonst finden useTranslations
  // im Browser keine Texte).
  const messages = await getMessages()

  // RTL für künftige Sprachen (z. B. Arabisch) wäre hier zu ergänzen.
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
