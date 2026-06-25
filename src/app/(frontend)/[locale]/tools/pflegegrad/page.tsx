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
    <main className="container-page max-w-2xl py-12">
      <span className="eyebrow">{t('title')}</span>
      <h1 className="mt-2 text-3xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-[var(--color-muted)]">{t('subtitle')}</p>
      {/* SEO-Text, serverseitig gerendert */}
      <p className="mt-3 text-sm text-[var(--color-muted)]">{t('intro')}</p>
      <PflegegradRechner />
    </main>
  )
}
