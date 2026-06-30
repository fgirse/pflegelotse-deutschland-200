import type { Metadata } from 'next'
import { Figtree, Noto_Sans } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import { setRequestLocale, getMessages } from 'next-intl/server'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { routing } from '@/i18n/routing'
import { SiteHeader, SiteFooter, ladeNavContext } from './SiteChrome'
import { BottomNav } from './SiteNav'
// Globales Stylesheet (Tailwind + Theme-Tokens) — MUSS importiert werden,
// sonst werden keine Styles angewendet.
import '@/app/(frontend)/globals.css'

// Distinctive, barrierearme Schriftpaarung: Figtree (Display) + Noto Sans (Body).
// next/font lädt selbst-gehostet, ohne Layout-Shift, mit display: swap.
const figtree = Figtree({ subsets: ['latin'], variable: '--font-figtree', display: 'swap' })
const noto = Noto_Sans({ subsets: ['latin'], variable: '--font-noto', display: 'swap' })

export const metadata: Metadata = {
  title: 'PflegeLotse Deutschland — Tourenoptimierung für ambulante Pflege',
  description:
    'Für Angehörige und Sozialdienste: unkompliziert Pflegedienste finden! Für ambulante Pflegedienste: Passgenaue Tourenlücken füllen — datenschutzkonform, barrierearm.',
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

// Der Header liest die Sitzung serverseitig aus dem Cookie — daher müssen die
// Seiten pro Request gerendert werden (kein statisches Prerendering).
export const dynamic = 'force-dynamic'

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
  // Sitzungskontext einmal laden — Header und Bottom-Bar teilen ihn sich.
  const ctx = await ladeNavContext()

  return (
    <html lang={locale} className={`${figtree.variable} ${noto.variable}`}>
      {/* Unten Platz für die fixe Bottom-Bar reservieren (nur Telefon < md),
          inkl. Safe-Area, damit kein Inhalt verdeckt wird. */}
      <body className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <NextIntlClientProvider messages={messages}>
          <a href="#inhalt" className="skip-link">
            {skip}
          </a>
          <SiteHeader locale={locale} ctx={ctx} />
          <div id="inhalt">{children}</div>
          <SiteFooter />
          <BottomNav bereichHref={ctx.bereichHref} angeboteBadge={ctx.angeboteBadge} />
        </NextIntlClientProvider>
        {/* Vercel Monitoring: Traffic (Analytics) + Web-Vitals (Speed Insights).
            Cookielos, ohne PII; senden nur in der Vercel-Produktion. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
