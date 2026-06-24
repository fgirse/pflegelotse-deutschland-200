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
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-sm text-slate-600">{t('subtitle')}</p>
      <LoginForm locale={locale} />
    </main>
  )
}
