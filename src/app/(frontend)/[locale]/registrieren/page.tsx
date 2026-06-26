import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { RegistrierenForm } from './RegistrierenForm'

// Registrierungsseite für beide Zielgruppen (Suchende & Pflegedienste).
export default async function RegistrierenPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('registrieren')

  return (
    <main className="container-page max-w-xl py-10 sm:py-14">
      <span className="eyebrow">{t('eyebrow')}</span>
      <h1 className="mt-2 text-3xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-[var(--color-muted)]">{t('subtitle')}</p>
      <RegistrierenForm locale={locale} />
      <p className="mt-4 text-sm text-[var(--color-muted)]">
        {t('schonKonto')}{' '}
        <Link href="/login" className="font-semibold text-[var(--color-accent)] hover:underline">
          {t('zumLogin')}
        </Link>
      </p>
    </main>
  )
}
