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
    <main className="container-page py-12">
      <span className="eyebrow">PflegeLotse</span>
      <h1 className="mt-2 text-3xl font-bold">{t('title')}</h1>
      <p className="mt-2 max-w-2xl text-[var(--color-muted)]">{t('subtitle')}</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Aktives Tool: Pflegegrad-Rechner */}
        <Link href="/tools/pflegegrad" className="tile">
          <h2 className="font-semibold">{t('pflegegradName')}</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{t('pflegegradDesc')}</p>
        </Link>

        {/* In Vorbereitung */}
        {[t('budgetName'), t('antragName'), t('checklistenName')].map((name) => (
          <div
            key={name}
            className="card border-dashed p-5 opacity-70"
          >
            <h2 className="font-semibold">{name}</h2>
            <p className="mt-1 text-sm text-[var(--color-faint)]">{t('bald')}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
