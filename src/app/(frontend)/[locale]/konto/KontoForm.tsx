'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PasswortFeld } from '../PasswortFeld'

// Passwortwechsel: aktuelles + neues Passwort (mit Wiederholung). Bei erzwungenem
// Wechsel (pflicht) leitet der Erfolg direkt weiter, sonst bleibt man mit Hinweis.
export function KontoForm({ pflicht, weiterZu }: { pflicht: boolean; weiterZu: string | null }) {
  const t = useTranslations('konto')
  const [aktuell, setAktuell] = useState('')
  const [neu, setNeu] = useState('')
  const [neu2, setNeu2] = useState('')
  const [erfolg, setErfolg] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const gueltig = aktuell.length >= 1 && neu.length >= 8 && neu === neu2 && neu !== aktuell

  async function speichern() {
    if (!gueltig || busy) return
    setBusy(true)
    setFehler(null)
    setErfolg(false)
    try {
      const res = await fetch('/api/v1/auth/passwort', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ aktuellesPasswort: aktuell, neuesPasswort: neu }),
      })
      if (res.status === 400) {
        // Client hat Länge/Gleichheit schon geprüft → 400 heißt: aktuelles falsch.
        setFehler(t('fehlerAktuell'))
        return
      }
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      if (weiterZu) {
        window.location.href = weiterZu
        return
      }
      setErfolg(true)
      setAktuell('')
      setNeu('')
      setNeu2('')
    } catch {
      setFehler(t('fehlerAllgemein'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-5">
      {pflicht && (
        <p className="mb-3 rounded-lg bg-accent-soft p-3 text-sm text-accent">{t('pflichtHinweis')}</p>
      )}
      {erfolg && (
        <p className="mb-3 rounded-lg bg-accent-soft p-3 text-sm text-accent">{t('erfolg')}</p>
      )}
      {fehler && <p className="mb-3 text-sm text-danger">⚠ {fehler}</p>}
      <div className="flex flex-col gap-3">
        <label className="label">
          {t('aktuell')}
          <PasswortFeld
            value={aktuell}
            onChange={setAktuell}
            autoComplete="current-password"
            labelAnzeigen={t('passwortAnzeigen')}
            labelVerbergen={t('passwortVerbergen')}
          />
        </label>
        <label className="label">
          {t('neu')}
          <PasswortFeld
            value={neu}
            onChange={setNeu}
            autoComplete="new-password"
            labelAnzeigen={t('passwortAnzeigen')}
            labelVerbergen={t('passwortVerbergen')}
          />
        </label>
        <label className="label">
          {t('neuWdh')}
          <PasswortFeld
            value={neu2}
            onChange={setNeu2}
            autoComplete="new-password"
            labelAnzeigen={t('passwortAnzeigen')}
            labelVerbergen={t('passwortVerbergen')}
          />
        </label>
        {neu2.length > 0 && neu !== neu2 && <p className="text-sm text-danger">{t('ungleich')}</p>}
        <button onClick={speichern} disabled={busy || !gueltig} className="btn btn-primary mt-1">
          {t('speichern')}
        </button>
      </div>
    </div>
  )
}
