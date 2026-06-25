import { setRequestLocale } from 'next-intl/server'
import { useTranslations } from 'next-intl'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <LoginInner locale={locale} />
}

function LoginInner({ locale }: { locale: string }) {
  const t = useTranslations('login')
  return (
    <main className="container-page max-w-md py-12 sm:py-16">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">{t('subtitle')}</p>
      <LoginForm locale={locale} />
    </main>
  )
}
