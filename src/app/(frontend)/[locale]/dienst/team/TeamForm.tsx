'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { PasswortFeld } from '../../PasswortFeld'
import type { MitarbeiterRolle, MitarbeiterZeile } from '@/shared/mitarbeiter'
import type { PflegekraftStammDaten } from '@/shared/pflegekraftStamm'
import { StammEditor } from './StammEditor'
import { AbwesenheitEditor } from './AbwesenheitEditor'

// Anlege-Formular + Liste der Mitarbeiter (Pflegekräfte + Disponenten). Der neu
// angelegte Mitarbeiter wird sofort oben in die Liste übernommen (ohne Reload).
export function TeamForm({
  anfangsListe,
  stammMap: stammMapInit,
}: {
  anfangsListe: MitarbeiterZeile[]
  stammMap: Record<string, PflegekraftStammDaten>
}) {
  const t = useTranslations('team')
  const [liste, setListe] = useState<MitarbeiterZeile[]>(anfangsListe)
  // Stammdaten je pflegekraftId (Vorbelegung der Editoren) + gerade offener Editor.
  const [stammMap, setStammMap] = useState(stammMapInit)
  const [stammFuer, setStammFuer] = useState<MitarbeiterZeile | null>(null)
  const [abwFuer, setAbwFuer] = useState<MitarbeiterZeile | null>(null)
  const [email, setEmail] = useState('')
  const [rolle, setRolle] = useState<MitarbeiterRolle>('pflegekraft')
  const [password, setPassword] = useState('')
  const [kuerzel, setKuerzel] = useState('')
  const [erfolg, setErfolg] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Läuft gerade eine Zeilen-Aktion (Deaktivieren/Löschen)? Merkt sich die ID.
  const [aktionBusy, setAktionBusy] = useState<string | null>(null)

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
          rolle,
          password,
          ...(rolle === 'pflegekraft' && kuerzel.trim()
            ? { pflegekraftId: kuerzel.trim() }
            : {}),
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

  // Deaktivieren/Aktivieren (Offboarding, reversibel).
  async function statusWechseln(m: MitarbeiterZeile) {
    if (aktionBusy) return
    setAktionBusy(m.id)
    setErfolg(null)
    setFehler(null)
    try {
      const res = await fetch(`/api/v1/team/mitarbeiter/${m.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deaktiviert: !m.deaktiviert }),
      })
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      const data = (await res.json()) as { mitarbeiter: MitarbeiterZeile }
      setListe((l) => l.map((x) => (x.id === m.id ? data.mitarbeiter : x)))
    } catch {
      setFehler(t('fehlerAllgemein'))
    } finally {
      setAktionBusy(null)
    }
  }

  // Passwort zurücksetzen: neues Initial-Passwort erzeugen (einmalig anzeigen).
  async function passwortReset(m: MitarbeiterZeile) {
    if (aktionBusy) return
    if (!window.confirm(t('passwortResetBestaetigen', { email: m.email }))) return
    setAktionBusy(m.id)
    setErfolg(null)
    setFehler(null)
    try {
      const res = await fetch(`/api/v1/team/mitarbeiter/${m.id}/reset`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ typ: 'passwort' }),
      })
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      const data = (await res.json()) as { tempPasswort: string }
      setErfolg(t('passwortResetErfolg', { email: m.email, passwort: data.tempPasswort }))
    } catch {
      setFehler(t('fehlerAllgemein'))
    } finally {
      setAktionBusy(null)
    }
  }

  // 2FA zurücksetzen (verlorenes Gerät): Faktor löschen → neue Einrichtung.
  async function zfaReset(m: MitarbeiterZeile) {
    if (aktionBusy) return
    if (!window.confirm(t('zfaResetBestaetigen', { email: m.email }))) return
    setAktionBusy(m.id)
    setErfolg(null)
    setFehler(null)
    try {
      const res = await fetch(`/api/v1/team/mitarbeiter/${m.id}/reset`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ typ: '2fa' }),
      })
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      const data = (await res.json()) as { mitarbeiter: MitarbeiterZeile }
      setListe((l) => l.map((x) => (x.id === m.id ? data.mitarbeiter : x)))
      setErfolg(t('zfaResetErfolg', { email: m.email }))
    } catch {
      setFehler(t('fehlerAllgemein'))
    } finally {
      setAktionBusy(null)
    }
  }

  // Endgültig löschen (mit Rückfrage).
  async function loeschen(m: MitarbeiterZeile) {
    if (aktionBusy) return
    if (!window.confirm(t('loeschenBestaetigen', { email: m.email }))) return
    setAktionBusy(m.id)
    setErfolg(null)
    setFehler(null)
    try {
      const res = await fetch(`/api/v1/team/mitarbeiter/${m.id}`, { method: 'DELETE' })
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      setListe((l) => l.filter((x) => x.id !== m.id))
    } catch {
      setFehler(t('fehlerAllgemein'))
    } finally {
      setAktionBusy(null)
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
          {/* Rollenauswahl: Pflegekraft (mobile Erfassung) oder Disponent. */}
          <div className="label">
            {t('rolle')}
            <div className="mt-1 flex gap-2" role="group" aria-label={t('rolle')}>
              {(['pflegekraft', 'disponent'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRolle(r)}
                  aria-pressed={rolle === r}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    rolle === r
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
                      : 'border-[var(--color-line)] text-[var(--color-muted)] hover:bg-[var(--color-line)]'
                  }`}
                >
                  {r === 'pflegekraft' ? t('rollePflegekraft') : t('rolleDisponent')}
                </button>
              ))}
            </div>
          </div>
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
          {/* Kürzel nur für Pflegekräfte relevant (Tour-Bindung). */}
          {rolle === 'pflegekraft' && (
            <label className="label">
              {t('kuerzel')}
              <input
                className="input"
                value={kuerzel}
                onChange={(e) => setKuerzel(e.target.value)}
              />
              <span className="mt-1 text-xs text-[var(--color-faint)]">{t('kuerzelHinweis')}</span>
            </label>
          )}
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
                  <th className="py-2 pr-4 font-medium">{t('spalteRolle')}</th>
                  <th className="py-2 pr-4 font-medium">{t('spalteKuerzel')}</th>
                  <th className="py-2 pr-4 font-medium">{t('spalte2fa')}</th>
                  <th className="py-2 pr-4 font-medium">{t('spalteStatus')}</th>
                  <th className="py-2 font-medium">{t('spalteAktionen')}</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((m) => (
                  <tr
                    key={m.id}
                    className={`border-b border-[var(--color-line)] last:border-0 ${
                      m.deaktiviert ? 'text-[var(--color-faint)]' : ''
                    }`}
                  >
                    <td className="py-2 pr-4">{m.email}</td>
                    <td className="py-2 pr-4">
                      {m.rolle === 'disponent' ? t('rolleDisponent') : t('rollePflegekraft')}
                    </td>
                    <td className="py-2 pr-4">
                      {m.pflegekraftId ?? <span className="text-[var(--color-faint)]">—</span>}
                    </td>
                    <td className="py-2 pr-4">
                      {m.totpEnabled ? (
                        <span className="text-[var(--color-success)]">● {t('aktiv')}</span>
                      ) : (
                        <span className="text-[var(--color-muted)]">○ {t('offen')}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {m.deaktiviert ? (
                        <span className="text-[var(--color-danger)]">{t('statusDeaktiviert')}</span>
                      ) : (
                        <span className="text-[var(--color-success)]">{t('statusAktiv')}</span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {m.rolle === 'pflegekraft' && (
                          <button
                            type="button"
                            onClick={() => {
                              setStammFuer(m)
                              setAbwFuer(null)
                            }}
                            disabled={!m.pflegekraftId}
                            title={!m.pflegekraftId ? t('stammKuerzelNoetig') : undefined}
                            className="whitespace-nowrap font-medium text-[var(--color-accent)] hover:underline disabled:opacity-50"
                          >
                            {t('stammBearbeiten')}
                          </button>
                        )}
                        {m.rolle === 'pflegekraft' && (
                          <button
                            type="button"
                            onClick={() => {
                              setAbwFuer(m)
                              setStammFuer(null)
                            }}
                            disabled={!m.pflegekraftId}
                            title={!m.pflegekraftId ? t('stammKuerzelNoetig') : undefined}
                            className="whitespace-nowrap font-medium text-[var(--color-accent)] hover:underline disabled:opacity-50"
                          >
                            {t('abwesenheiten')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => statusWechseln(m)}
                          disabled={aktionBusy === m.id}
                          className="whitespace-nowrap font-medium text-[var(--color-accent)] hover:underline disabled:opacity-50"
                        >
                          {m.deaktiviert ? t('aktivieren') : t('deaktivieren')}
                        </button>
                        <button
                          type="button"
                          onClick={() => passwortReset(m)}
                          disabled={aktionBusy === m.id}
                          className="whitespace-nowrap font-medium text-[var(--color-accent)] hover:underline disabled:opacity-50"
                        >
                          {t('passwortReset')}
                        </button>
                        <button
                          type="button"
                          onClick={() => zfaReset(m)}
                          disabled={aktionBusy === m.id}
                          className="whitespace-nowrap font-medium text-[var(--color-accent)] hover:underline disabled:opacity-50"
                        >
                          {t('zfaReset')}
                        </button>
                        <button
                          type="button"
                          onClick={() => loeschen(m)}
                          disabled={aktionBusy === m.id}
                          className="whitespace-nowrap font-medium text-[var(--color-danger)] hover:underline disabled:opacity-50"
                        >
                          {t('loeschen')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Stammdaten-Editor (nur eine Pflegekraft gleichzeitig). key erzwingt
          Neu-Vorbelegung beim Wechsel der Zeile. */}
      {stammFuer && (
        <StammEditor
          key={stammFuer.id}
          mitarbeiter={stammFuer}
          initial={stammFuer.pflegekraftId ? stammMap[stammFuer.pflegekraftId] : undefined}
          onSaved={(pflegekraftId, daten) => {
            setStammMap((m) => ({ ...m, [pflegekraftId]: daten }))
            setErfolg(t('stammErfolg', { email: stammFuer.email }))
            setStammFuer(null)
          }}
          onClose={() => setStammFuer(null)}
        />
      )}

      {/* Abwesenheiten-Editor (lädt seine Liste selbst). */}
      {abwFuer && (
        <AbwesenheitEditor
          key={abwFuer.id}
          mitarbeiter={abwFuer}
          onClose={() => setAbwFuer(null)}
        />
      )}
    </div>
  )
}
