import { setRequestLocale } from 'next-intl/server'
import { useTranslations } from 'next-intl'
import { BedarfForm } from './BedarfForm'

// Angehörigen-Marktplatz: Einstieg mit zweistufigem Bedarfsformular (mobile-first).
export default async function MarktPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <MarktInner />
}

function MarktInner() {
  const t = useTranslations('markt')
  return (
    <main className="container-page max-w-xl py-10 sm:py-14">
      <span className="eyebrow">{t('step1')}</span>
      <h1 className="mt-2 text-3xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-[var(--color-muted)]">{t('subtitle')}</p>
      <BedarfForm />
    </main>
  )
}
