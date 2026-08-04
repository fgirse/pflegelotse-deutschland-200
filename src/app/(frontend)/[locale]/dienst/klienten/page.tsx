import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { requireDienstSeite } from '@/server/auth/page'
import { ladeKlientenListe } from '@/server/klienten/liste'

// Klientenliste (Stammdaten): führt Identität (Säule 1) und operative Merkmale
// (Säule 2) zusammen. Liest zur Laufzeit, kein statisches Prerendering.
export const dynamic = 'force-dynamic'

export default async function KlientenPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await requireDienstSeite(locale)
  // Klientenstammdaten pflegen Disponent und Inhaber (nicht die Pflegekraft).
  if (user.role !== 'admin' && user.role !== 'disponent') redirect(`/${locale}/dashboard`)

  const t = await getTranslations('klienten')
  const klienten = await ladeKlientenListe(user.tenantId)

  return (
    <main className="container-page max-w-5xl py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-[var(--color-muted)]">{t('subtitle', { n: klienten.length })}</p>
      </header>

      <section className="card p-5">
        {klienten.length === 0 ? (
          <p className="text-sm text-[var(--color-faint)]">{t('leer')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)]">
                  <th className="py-2 pr-4 font-medium">{t('spalteName')}</th>
                  <th className="py-2 pr-4 font-medium">{t('spalteGeburt')}</th>
                  <th className="py-2 pr-4 font-medium">{t('spalteVersicherung')}</th>
                  <th className="py-2 pr-4 font-medium">{t('spalteLeistungen')}</th>
                  <th className="py-2 pr-4 font-medium">{t('spaltePflegegrad')}</th>
                  <th className="py-2 font-medium">{t('spalteStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {klienten.map((k) => (
                  <tr key={k.pseudonymId} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="py-2 pr-4">
                      {k.nachname || k.vorname ? (
                        <span className="font-medium">
                          {k.nachname}
                          {k.nachname && k.vorname ? ', ' : ''}
                          {k.vorname}
                        </span>
                      ) : (
                        <span className="text-[var(--color-faint)]">{t('ohneIdentitaet')}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{k.geburtsdatum ?? '—'}</td>
                    <td className="py-2 pr-4">
                      {k.kostentraegerArt
                        ? t(k.kostentraegerArt === 'gesetzlich' ? 'gesetzlich' : 'privat')
                        : '—'}
                      {k.krankenversicherer ? ` · ${k.krankenversicherer}` : ''}
                    </td>
                    <td className="py-2 pr-4">
                      {k.leistungen.length > 0 ? (
                        k.leistungen.join(', ')
                      ) : (
                        <span className="text-[var(--color-faint)]">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{k.pflegegrad ?? '—'}</td>
                    <td className="py-2">{t(`status_${k.status}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
