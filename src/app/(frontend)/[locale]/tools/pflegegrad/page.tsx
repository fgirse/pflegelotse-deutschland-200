import type { Metadata } from 'next'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { useTranslations } from 'next-intl'
import { PflegegradRechner } from './PflegegradRechner'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'pflegegrad' })
  return { title: `${t('title')} — PflegeLotse`, description: t('subtitle') }
}

export default async function PflegegradPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return <Inner />
}

function Inner() {
  const t = useTranslations('pflegegrad')
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-slate-600">{t('subtitle')}</p>
      {/* SEO-Text, serverseitig gerendert */}
      <p className="mt-3 text-sm text-slate-600">{t('intro')}</p>
      <PflegegradRechner />
    </main>
  )
}
