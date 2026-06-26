import { setRequestLocale, getTranslations } from 'next-intl/server'
import { requireDienstSeite } from '@/server/auth/page'
import { EinzugsgebietForm } from './EinzugsgebietForm'

export const dynamic = 'force-dynamic'

// Dienst-Seite: Einzugsgebiet festlegen (geschützt, Auth + 2FA + Mandant).
export default async function EinzugsgebietPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireDienstSeite(locale)
  const t = await getTranslations('einzugsgebiet')

  return (
    <main className="container-page max-w-xl py-10 sm:py-14">
      <span className="eyebrow">{t('eyebrow')}</span>
      <h1 className="mt-2 text-3xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-[var(--color-muted)]">{t('subtitle')}</p>
      <EinzugsgebietForm />
    </main>
  )
}
