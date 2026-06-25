import type { Metadata } from 'next'
import { Figtree, Noto_Sans } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import { setRequestLocale, getMessages } from 'next-intl/server'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { routing } from '@/i18n/routing'
import { SiteHeader, SiteFooter } from './SiteChrome'
import '../globals.css'

// Distinctive, barrierearme Schriftpaarung: Figtree (Display) + Noto Sans (Body).
// next/font lädt selbst-gehostet, ohne Layout-Shift, mit display: swap.
const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree', display: 'swap' })
const noto = Noto_Sans({ subsets: ['latin'], variable: '--font-noto', display: 'swap' })

export const metadata: Metadata = {
  title: 'PflegeLotse — Tourenoptimierung für ambulante Pflege',
  description:
    'Passgenaue Tourenlücken füllen und Pflegedienste finden — datenschutzkonform, barrierearm.',
}

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

  setRequestLocale(locale)
  const messages = await getMessages()
  const skip = locale === 'en' ? 'Skip to content' : 'Zum Inhalt springen'

  return (
    <html lang={locale} className={`${figtree.variable} ${noto.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <a href="#inhalt" className="skip-link">
            {skip}
          </a>
          <SiteHeader locale={locale} />
          <div id="inhalt">{children}</div>
          <SiteFooter />
        </NextIntlClientProvider>
        {/* Vercel Monitoring: Traffic (Analytics) + Web-Vitals (Speed Insights).
            Cookielos, ohne PII; senden nur in der Vercel-Produktion. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
