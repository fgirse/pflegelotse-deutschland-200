'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PasswortFeld } from '../../PasswortFeld'
import type { MitarbeiterZeile } from '@/shared/mitarbeiter'

// Anlege-Formular + Liste der Pflegekräfte. Die neu angelegte Kraft wird sofort
// oben in die Liste übernommen (ohne Reload).
export function TeamForm({ anfangsListe }: { anfangsListe: MitarbeiterZeile[] }) {
  const t = useTranslations('team')
  const [liste, setListe] = useState<MitarbeiterZeile[]>(anfangsListe)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [kuerzel, setKuerzel] = useState('')
  const [erfolg, setErfolg] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const gueltig = /\S+@\S+\.\S+/.test(email) && password.length >= 8

  async function anlegen() {
    if (!gueltig || busy) return
    setBusy(true)
    setErfolg(null)
    setFehler(null)
    try {
      const res = await fetch('/api/v1/team/mitarbeiter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(kuerzel.trim() ? { pflegekraftId: kuerzel.trim() } : {}),
        }),
      })
      if (res.status === 409) {
        setFehler(t('fehlerEmailExists'))
        return
      }
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      const data = (await res.json()) as { mitarbeiter: MitarbeiterZeile }
      setListe((l) => [data.mitarbeiter, ...l])
      setErfolg(t('erfolg', { email: data.mitarbeiter.email }))
      setEmail('')
      setPassword('')
      setKuerzel('')
    } catch {
      setFehler(t('fehlerAllgemein'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Anlege-Formular */}
      <section className="card p-5">
        <h2 className="font-display text-lg font-semibold">{t('neuTitel')}</h2>
        {erfolg && (
          <p className="mt-3 rounded-lg bg-accent-soft p-3 text-sm text-accent">{erfolg}</p>
        )}
        {fehler && <p className="mt-3 text-sm text-danger">⚠ {fehler}</p>}
        <div className="mt-4 flex flex-col gap-3">
          <label className="label">
            {t('email')}
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="label">
            {t('passwort')}
            <PasswortFeld
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              labelAnzeigen={t('passwortAnzeigen')}
              labelVerbergen={t('passwortVerbergen')}
            />
            <span className="mt-1 text-xs text-[var(--color-faint)]">{t('passwortHinweis')}</span>
          </label>
          <label className="label">
            {t('kuerzel')}
            <input className="input" value={kuerzel} onChange={(e) => setKuerzel(e.target.value)} />
            <span className="mt-1 text-xs text-[var(--color-faint)]">{t('kuerzelHinweis')}</span>
          </label>
          <button onClick={anlegen} disabled={busy || !gueltig} className="btn btn-primary mt-1">
            {t('anlegen')}
          </button>
        </div>
      </section>

      {/* Liste */}
      <section className="card p-5">
        <h2 className="font-display text-lg font-semibold">{t('listeTitel')}</h2>
        {liste.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-faint)]">{t('listeLeer')}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)]">
                  <th className="py-2 pr-4 font-medium">{t('spalteEmail')}</th>
                  <th className="py-2 pr-4 font-medium">{t('spalteKuerzel')}</th>
                  <th className="py-2 font-medium">{t('spalte2fa')}</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="py-2 pr-4">{m.email}</td>
                    <td className="py-2 pr-4">
                      {m.pflegekraftId ?? <span className="text-[var(--color-faint)]">—</span>}
                    </td>
                    <td className="py-2">
                      {m.totpEnabled ? (
                        <span className="text-[var(--color-success)]">● {t('aktiv')}</span>
                      ) : (
                        <span className="text-[var(--color-muted)]">○ {t('offen')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
