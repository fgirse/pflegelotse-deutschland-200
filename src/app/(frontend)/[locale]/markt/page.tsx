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
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-slate-600">{t('subtitle')}</p>
      <BedarfForm />
    </main>
  )
}
