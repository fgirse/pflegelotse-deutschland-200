import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { requireDienstSeite } from '@/server/auth/page'
import { listeMitarbeiter } from '@/server/team/service'
import { ladeAllePflegekraftStamm } from '@/server/stammdaten/service'
import { TeamForm } from './TeamForm'

// Team-Verwaltung: liest zur Laufzeit die Pflegekräfte des Mandanten —
// kein statisches Prerendering.
export const dynamic = 'force-dynamic'

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await requireDienstSeite(locale)
  // Nur der Dienst-Inhaber (admin) verwaltet das Team; andere Rollen zurück.
  if (user.role !== 'admin') redirect(`/${locale}/dashboard`)

  const t = await getTranslations('team')
  const [mitarbeiter, stammMap] = await Promise.all([
    listeMitarbeiter(user.tenantId),
    ladeAllePflegekraftStamm(user.tenantId),
  ])

  return (
    <main className="container-page max-w-3xl py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-[var(--color-muted)]">{t('subtitle')}</p>
      </header>
      <TeamForm anfangsListe={mitarbeiter} stammMap={stammMap} />
    </main>
  )
}
