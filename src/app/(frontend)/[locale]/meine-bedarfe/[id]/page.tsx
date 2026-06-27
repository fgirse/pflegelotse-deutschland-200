import { setRequestLocale, getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { requireAngehoerige } from '@/server/auth/page'
import { bedarfGehoertNutzer } from '@/server/marketplace/service'
import { AngeboteView } from '../../markt/[id]/AngeboteView'

export const dynamic = 'force-dynamic'

// Besitzer-verifizierte Angebots-Ansicht innerhalb des Portals: Angebote
// vergleichen und Dienst wählen, ohne über die öffentliche Markt-Seite zu gehen.
export default async function MeinBedarfDetail({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const user = await requireAngehoerige(locale)
  // Nur eigene Bedarfe — sonst zurück zur Übersicht.
  if (!(await bedarfGehoertNutzer(id, user.id))) redirect(`/${locale}/meine-bedarfe`)
  const t = await getTranslations('meineBedarfe')

  return (
    <main className="container-page max-w-xl py-10 sm:py-14">
      <Link href="/meine-bedarfe" className="text-sm text-[var(--color-accent)] hover:underline">
        ← {t('zurueck')}
      </Link>
      <div className="mt-4">
        <AngeboteView bedarfId={id} />
      </div>
    </main>
  )
}
