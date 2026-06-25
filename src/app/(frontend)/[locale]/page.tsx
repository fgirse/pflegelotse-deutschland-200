import { useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

// Startseite (Marketplace-Landing): Hero mit doppeltem Einstieg
// (Angehörige / Dienste), Vertrauenspunkte, Zielgruppen-Split, Tools-Teaser.
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <HomeInner />
}

function HomeInner() {
  const t = useTranslations('home')
  const tm = useTranslations('markt')
  const tt = useTranslations('tools')
  const tl = useTranslations('lotse')

  const trust = [
    { titel: t('trust1Title'), text: t('trust1Text') },
    { titel: t('trust2Title'), text: t('trust2Text') },
    { titel: t('trust3Title'), text: t('trust3Text') },
  ]

  return (
    <main>
      {/* Hero */}
      <section className="container-page grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="eyebrow">{t('heroEyebrow')}</span>
          <h1 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            {t('heroTitle')}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            {t('heroSub')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/markt" className="btn btn-accent">
              {tm('title')}
            </Link>
            <Link href="/dashboard" className="btn btn-outline">
              {t('ctaDienst')}
            </Link>
          </div>
        </div>

        {/* Vertrauens-Panel als ruhige Karte */}
        <div className="card p-6 sm:p-8">
          <ul className="flex flex-col gap-6">
            {trust.map((item, i) => (
              <li key={i} className="flex gap-4">
                <span
                  aria-hidden
                  className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-sm font-bold text-accent"
                >
                  {i + 1}
                </span>
                <div>
                  <div className="font-display font-semibold">{item.titel}</div>
                  <div className="text-sm text-muted">{item.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Zielgruppen-Split */}
      <section className="container-page grid gap-6 pb-4 md:grid-cols-2">
        <div className="card flex flex-col p-7">
          <span className="eyebrow">{t('relativesTitle')}</span>
          <p className="mt-3 flex-1 leading-relaxed text-muted">
            {t('relativesText')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/markt" className="btn btn-primary">
              {tm('title')}
            </Link>
            <Link href="/lotse" className="btn btn-outline">
              {tl('title')}
            </Link>
          </div>
        </div>

        <div className="card flex flex-col p-7">
          <span className="eyebrow">{t('servicesTitle')}</span>
          <p className="mt-3 flex-1 leading-relaxed text-muted">
            {t('servicesText')}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/dashboard" className="btn btn-primary">
              {t('openDashboard')}
            </Link>
            <Link href="/eingaenge" className="btn btn-outline">
              {tm('dienstTitel')}
            </Link>
          </div>
        </div>
      </section>

      {/* Tools-Teaser */}
      <section className="container-page py-16">
        <Link
          href="/tools"
          className="card flex flex-col items-start justify-between gap-4 p-7 transition-all duration-200 hover:-translate-y-0.5 hover:border-faint sm:flex-row sm:items-center"
        >
          <div>
            <h2 className="font-display text-xl font-semibold">{t('toolsTeaserTitle')}</h2>
            <p className="mt-1 text-sm text-muted">{t('toolsTeaserText')}</p>
          </div>
          <span className="chip">{tt('pflegegradName')} →</span>
        </Link>
      </section>
    </main>
  )
}
