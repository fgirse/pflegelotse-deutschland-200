import { setRequestLocale } from 'next-intl/server'
import { useTranslations } from 'next-intl'
import { LotseChat } from './LotseChat'

export const dynamic = 'force-dynamic'

// KI-Pflegelotse (/F600/) — öffentliche Angehörigen-Seite.
export default async function LotsePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <LotseInner locale={locale} />
}

function LotseInner({ locale }: { locale: string }) {
  const t = useTranslations('lotse')
  return (
    <main className="container-page max-w-2xl py-10 sm:py-14">
      <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
      <p className="mt-2 text-[var(--color-muted)]">{t('subtitle')}</p>
      <LotseChat locale={locale} />
    </main>
  )
}
