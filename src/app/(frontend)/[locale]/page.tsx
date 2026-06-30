import Image from 'next/image'
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
      {/* Hero: links die Botschaft, rechts ein hochwertiges Pflegeteam-Foto. */}
      <section className="container-page grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <span className="eyebrow">{t('heroEyebrow')}</span>
          <h1 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
            {t.rich('heroTitle', {
              // Hebt „ambulante Pflegedienste:" hervor: Amber-Verlauf (oben
              // amber-600 → unten amber-300) als geclonte Inline-Fläche plus
              // mehrlagiger Text-Schatten für einen plastischen 3D-Eindruck.
              hl: (chunks) => (
                <span className="box-decoration-clone rounded-md bg-[linear-gradient(to_bottom,#d97706,#fcd34d)] px-2 text-[var(--color-ink)] [text-shadow:0_-1px_0_rgba(255,255,255,0.55),0_1px_0_#b45309,0_2px_0_#92400e,0_3px_0_#7c360c,0_4px_0_#5c2a0c,0_6px_8px_rgba(0,0,0,0.40)]">
                  {chunks}
                </span>
              ),
            })}
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

        {/* Hero-Bild: vielfältiges, professionelles Pflegeteam. Weiche
            Akzentfläche dahinter für Tiefe; priority = LCP-Bild. */}
        <div className="relative">
          <div
            aria-hidden
            className="absolute -inset-3 -z-10 rounded-[2rem] bg-accent-soft opacity-70 blur-2xl"
          />
          <Image
            src="/Assets/Img/pflegedienst_team.png"
            alt={t('heroBildAlt')}
            width={1536}
            height={1024}
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="h-auto w-full rounded-2xl border border-[var(--color-line)] object-cover shadow-xl"
          />
        </div>
      </section>

      {/* Vertrauenspunkte als ruhiger Streifen unter dem Hero. */}
      <section className="container-page pb-4">
        <ul className="grid gap-4 sm:grid-cols-3">
          {trust.map((item, i) => (
            <li key={i} className="card flex gap-4 p-6">
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
