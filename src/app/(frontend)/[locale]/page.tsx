import { useTranslations } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

// Startseite. Schlicht — Einstieg zum Disponenten-Dashboard.
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <HomeInner />
}

function HomeInner() {
  const t = useTranslations('home')
  const tm = useTranslations('markt')
  const ta = useTranslations('abo')
  const tl = useTranslations('lotse')
  const tp = useTranslations('praevention')
  const tt = useTranslations('tools')
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
      <p className="text-lg text-slate-600">{t('subtitle')}</p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800"
        >
          {t('openDashboard')}
        </Link>
        <Link
          href="/markt"
          className="inline-block rounded-lg border border-blue-700 px-5 py-3 font-medium text-blue-700 hover:bg-blue-50"
        >
          {tm('title')}
        </Link>
        <Link
          href="/lotse"
          className="inline-block rounded-lg border border-blue-700 px-5 py-3 font-medium text-blue-700 hover:bg-blue-50"
        >
          {tl('title')}
        </Link>
        <Link
          href="/tools"
          className="inline-block rounded-lg border border-blue-700 px-5 py-3 font-medium text-blue-700 hover:bg-blue-50"
        >
          {tt('title')}
        </Link>
        <Link
          href="/eingaenge"
          className="inline-block rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
        >
          {tm('dienstTitel')}
        </Link>
        <Link
          href="/abo"
          className="inline-block rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
        >
          {ta('title')}
        </Link>
        <Link
          href="/praevention"
          className="inline-block rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
        >
          {tp('title')}
        </Link>
      </div>
    </main>
  )
}
