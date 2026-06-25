import { setRequestLocale } from 'next-intl/server'
import { AngeboteView } from './AngeboteView'

// Angebots-Vergleich für einen eingestellten Bedarf.
export default async function BedarfDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)
  return (
    <main className="container-page max-w-xl py-10 sm:py-14">
      <AngeboteView bedarfId={id} />
    </main>
  )
}
