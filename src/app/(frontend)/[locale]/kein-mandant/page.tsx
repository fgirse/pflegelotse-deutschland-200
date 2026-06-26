import { setRequestLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

// Hinweisseite für angemeldete Konten ohne Mandantenzuordnung. Verhindert die
// verwirrende Login-Schleife (sah aus wie ein 2FA-Fehler) mit klarer Ansage.
export default async function KeinMandantPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('keinMandant')

  return (
    <main className="container-page py-16">
      <div className="card mx-auto max-w-lg p-8 text-center">
        <span className="eyebrow">{t('eyebrow')}</span>
        <h1 className="mt-3 text-2xl font-bold">{t('title')}</h1>
        <p className="mt-3 leading-relaxed text-[var(--color-muted)]">{t('text')}</p>
        <Link href="/login" className="btn btn-outline mt-6">
          {t('zurueck')}
        </Link>
      </div>
    </main>
  )
}
