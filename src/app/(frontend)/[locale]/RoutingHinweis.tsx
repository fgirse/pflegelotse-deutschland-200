import { getTranslations } from 'next-intl/server'
import { routingStatus } from '@/server/routing/konfig'

// Sagt dem Disponenten, worauf die angezeigten Fahrzeiten beruhen.
//
// Ohne diesen Hinweis ist der gefährlichste Zustand der unsichtbare: Fällt der
// Routing-Server aus, rechnet das System klaglos mit Luftlinie weiter und der
// Dienst trifft Dispositionsentscheidungen auf Zahlen, die er für Straßen-
// fahrzeiten hält. Deshalb erscheint das Banner NUR im Luftlinien-Modus — im
// Normalbetrieb bleibt die Oberfläche unverändert ruhig.
export async function RoutingHinweis() {
  const status = await routingStatus().catch(() => null)
  if (!status || status.modus === 'strasse') return null

  const t = await getTranslations('routing')
  const grund = status.grund ?? 'nichtKonfiguriert'
  // Fehlkonfiguration und Ausfall sind Störfälle (rot); reine Luftlinien-
  // Konfiguration ist eine bewusste Betreiber-Entscheidung (dezent).
  const stoerfall = grund !== 'nichtKonfiguriert'

  return (
    <div
      role="status"
      className={`mb-6 rounded-[var(--radius)] border p-4 text-sm ${
        stoerfall
          ? 'border-[var(--color-danger)] bg-[var(--color-surface)]'
          : 'border-[var(--color-line)] bg-[var(--color-accent-soft)]'
      }`}
    >
      <strong className={stoerfall ? 'text-[var(--color-danger)]' : 'text-[var(--color-accent)]'}>
        {stoerfall && <span aria-hidden>⚠ </span>}
        {t('luftlinieTitel')}
      </strong>{' '}
      <span className="text-[var(--color-muted)]">{t(`grund_${grund}`)}</span>
    </div>
  )
}
