'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Typ = 'suchende' | 'dienst'

// Selbstregistrierung für beide Zielgruppen. Rolle/Mandant setzt der Server;
// hier nur die fachlichen Felder. Nach Erfolg geht es zur Anmeldung (Dienste
// richten dort 2FA ein, Suchende landen direkt im Marktplatz).
export function RegistrierenForm({ locale }: { locale: string }) {
  const t = useTranslations('registrieren')
  const [typ, setTyp] = useState<Typ>('suchende')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [suchendeTyp, setSuchendeTyp] = useState('angehoerige')
  const [dienstName, setDienstName] = useState('')
  const [ort, setOrt] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function absenden() {
    setBusy(true)
    setFehler(null)
    try {
      const body =
        typ === 'dienst'
          ? { typ, email, password, dienstName, ort: ort || undefined }
          : { typ, email, password, suchendeTyp }
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 409) {
        setFehler(t('fehlerEmailExists'))
        return
      }
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      // Zur Anmeldung mit vorbelegter E-Mail und Erfolgshinweis.
      window.location.href = `/${locale}/login?registriert=1&email=${encodeURIComponent(email)}`
    } finally {
      setBusy(false)
    }
  }

  const tabCls = (aktiv: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
      aktiv
        ? 'bg-[var(--color-ink)] text-white'
        : 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-line)]'
    }`

  const bereit =
    email.length > 3 &&
    password.length >= 8 &&
    (typ === 'suchende' || dienstName.length >= 2)

  return (
    <div className="card mt-6 p-5">
      {/* Zielgruppen-Umschalter */}
      <div className="flex gap-2" role="tablist" aria-label={t('typLabel')}>
        <button type="button" className={tabCls(typ === 'suchende')} onClick={() => setTyp('suchende')}>
          {t('typSuchende')}
        </button>
        <button type="button" className={tabCls(typ === 'dienst')} onClick={() => setTyp('dienst')}>
          {t('typDienst')}
        </button>
      </div>

      <p className="mt-3 text-sm text-[var(--color-muted)]">
        {typ === 'dienst' ? t('hinweisDienst') : t('hinweisSuchende')}
      </p>

      {fehler && <p className="mt-3 text-sm text-[var(--color-danger)]">⚠ {fehler}</p>}

      <div className="mt-4 flex flex-col gap-3">
        {typ === 'suchende' && (
          <label className="label">
            {t('suchendeTypLabel')}
            <select
              className="input"
              value={suchendeTyp}
              onChange={(e) => setSuchendeTyp(e.target.value)}
            >
              <option value="angehoerige">{t('suchendeAngehoerige')}</option>
              <option value="patient">{t('suchendePatient')}</option>
              <option value="sozialdienst">{t('suchendeSozialdienst')}</option>
            </select>
          </label>
        )}

        {typ === 'dienst' && (
          <>
            <label className="label">
              {t('dienstName')}
              <input className="input" value={dienstName} onChange={(e) => setDienstName(e.target.value)} />
            </label>
            <label className="label">
              {t('ort')}
              <input className="input" value={ort} onChange={(e) => setOrt(e.target.value)} />
            </label>
          </>
        )}

        <label className="label">
          {t('email')}
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="label">
          {t('password')}
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        <button onClick={absenden} disabled={busy || !bereit} className="btn btn-accent mt-1">
          {t('absenden')}
        </button>
      </div>
    </div>
  )
}
