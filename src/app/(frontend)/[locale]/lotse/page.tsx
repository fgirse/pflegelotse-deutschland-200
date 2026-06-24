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
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-slate-600">{t('subtitle')}</p>
      <LotseChat locale={locale} />
    </main>
  )
}
