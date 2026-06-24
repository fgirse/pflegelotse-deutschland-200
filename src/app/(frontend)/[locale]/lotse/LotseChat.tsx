'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import type { KiNachricht, BedarfEntwurf } from '@/shared/ki'

// Chat-Widget des KI-Pflegelotsen. Die lokale Intro-Nachricht wird nur
// angezeigt, NICHT an die API gesendet (Anthropic erwartet zuerst eine
// user-Nachricht). Gesendet wird ausschließlich Chat-Text — keine PII (/F640/).
export function LotseChat({ locale }: { locale: string }) {
  const t = useTranslations('lotse')
  const router = useRouter()
  const [verlauf, setVerlauf] = useState<KiNachricht[]>([])
  const [eingabe, setEingabe] = useState('')
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState(false)
  const [entwurf, setEntwurf] = useState<BedarfEntwurf | null>(null)

  async function senden() {
    const text = eingabe.trim()
    if (!text || busy) return
    const neuerVerlauf: KiNachricht[] = [...verlauf, { role: 'user', content: text }]
    setVerlauf(neuerVerlauf)
    setEingabe('')
    setBusy(true)
    setFehler(false)
    try {
      const res = await fetch('/api/v1/ki/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nachrichten: neuerVerlauf }),
      })
      if (!res.ok) throw new Error('fehler')
      const data = await res.json()
      setVerlauf([...neuerVerlauf, { role: 'assistant', content: data.antwort }])
      if (data.entwurf) setEntwurf(data.entwurf)
    } catch {
      setFehler(true)
    } finally {
      setBusy(false)
    }
  }

  function uebernehmen() {
    if (!entwurf) return
    // Entwurf für das Bedarfsformular hinterlegen.
    sessionStorage.setItem('bedarfEntwurf', JSON.stringify(entwurf))
    router.push('/markt')
  }

  return (
    <div className="mt-6">
      <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">{t('hinweis')}</p>

      <div className="flex flex-col gap-3 rounded-lg border bg-white p-4" aria-live="polite">
        {/* Lokale Intro-Nachricht */}
        <div className="max-w-[85%] self-start rounded-lg bg-slate-100 px-3 py-2 text-sm">
          {t('intro')}
        </div>
        {verlauf.map((n, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              n.role === 'user'
                ? 'self-end bg-blue-700 text-white'
                : 'self-start bg-slate-100'
            }`}
          >
            {n.content}
          </div>
        ))}
        {busy && <div className="self-start text-sm text-slate-500">{t('denkt')}</div>}
        {fehler && <div className="self-start text-sm text-red-700">{t('fehler')}</div>}
      </div>

      {/* Eingabe */}
      <div className="mt-3 flex gap-2">
        <input
          value={eingabe}
          onChange={(e) => setEingabe(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && senden()}
          placeholder={t('placeholder')}
          className="flex-1 rounded-md border border-slate-300 px-3 py-2"
        />
        <button
          onClick={senden}
          disabled={busy || !eingabe.trim()}
          className="rounded-md bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {t('senden')}
        </button>
      </div>

      {/* Vorgeschlagener Bedarf */}
      {entwurf && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <h2 className="font-semibold">{t('entwurfTitel')}</h2>
          <ul className="mt-2 text-sm text-slate-700">
            {entwurf.ort && <li>Ort: {entwurf.ort}</li>}
            {entwurf.pflegegrad && <li>Pflegegrad: {entwurf.pflegegrad}</li>}
            {entwurf.leistungen.length > 0 && <li>Leistungen: {entwurf.leistungen.join(', ')}</li>}
            {entwurf.qualifikation.length > 0 && (
              <li>Qualifikation: {entwurf.qualifikation.join(', ')}</li>
            )}
            {(entwurf.zeitVon || entwurf.zeitBis) && (
              <li>
                Zeit: {entwurf.zeitVon ?? '—'}–{entwurf.zeitBis ?? '—'}
              </li>
            )}
          </ul>
          <button
            onClick={uebernehmen}
            className="mt-3 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            {t('uebernehmen')}
          </button>
        </div>
      )}
    </div>
  )
}
