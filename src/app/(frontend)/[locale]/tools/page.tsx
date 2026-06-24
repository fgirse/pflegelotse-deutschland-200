import type { Metadata } from 'next'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

// Öffentliche, SEO-fähige Tools-Übersicht (/F700/) — kein Auth, keine PII.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'tools' })
  return { title: `${t('title')} — PflegeLotse`, description: t('subtitle') }
}

export default async function ToolsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <ToolsInner />
}

function ToolsInner() {
  const t = useTranslations('tools')
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="mt-1 text-slate-600">{t('subtitle')}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/tools/pflegegrad"
          className="rounded-lg border bg-white p-4 hover:border-blue-700 hover:bg-blue-50"
        >
          <h2 className="font-semibold">{t('pflegegradName')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('pflegegradDesc')}</p>
        </Link>

        {/* In Vorbereitung */}
        {[t('budgetName'), t('antragName'), t('checklistenName')].map((name) => (
          <div key={name} className="rounded-lg border border-dashed bg-slate-50 p-4 opacity-70">
            <h2 className="font-semibold">{name}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('bald')}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
