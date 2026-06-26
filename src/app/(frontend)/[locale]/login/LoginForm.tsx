'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

type Schritt = 'login' | 'enroll' | 'verify'

// Login mit zweitem Faktor. Reihenfolge: Passwort → (Ersteinrichtung der 2FA
// oder) Code-Bestätigung → Weiterleitung. Dienst-Rollen mit 2FA gehen ins
// Dashboard, Suchende ohne 2FA direkt in den Marktplatz.
export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations('login')
  const params = useSearchParams()
  // Nach Registrierung: E-Mail vorbelegen + Erfolgshinweis zeigen.
  const [schritt, setSchritt] = useState<Schritt>('login')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [secret, setSecret] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const registriert = params.get('registriert') === '1'

  const inputCls = 'input'
  // Ziel nach abgeschlossener 2FA (Dienst-Rollen).
  const ziel = `/${locale}/dashboard`

  async function login() {
    setBusy(true)
    setFehler(null)
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        setFehler(t('fehlerLogin'))
        return
      }
      const data = await res.json()
      if (data.needsEnrollment) {
        // 2FA erstmalig einrichten (Dienst-Rollen).
        const e = await fetch('/api/v1/auth/2fa/enroll', { method: 'POST' })
        const ed = await e.json()
        setSecret(ed.secret)
        setQrDataUrl(ed.qrDataUrl)
        setSchritt('enroll')
      } else if (data.twoFactorRequired) {
        // 2FA-Code bestätigen.
        setSchritt('verify')
      } else {
        // Keine 2FA-Pflicht (Suchende): weiter ins eigene Bedarfe-Portal.
        window.location.href =
          data.role === 'angehoeriger' ? `/${locale}/meine-bedarfe` : ziel
      }
    } finally {
      setBusy(false)
    }
  }

  async function code2fa(pfad: 'activate' | 'verify') {
    setBusy(true)
    setFehler(null)
    try {
      const res = await fetch(`/api/v1/auth/2fa/${pfad}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (!res.ok) {
        setFehler(t('fehlerCode'))
        return
      }
      window.location.href = ziel
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mt-6 p-5">
      {registriert && schritt === 'login' && (
        <p className="mb-3 rounded-lg bg-accent-soft p-3 text-sm text-accent">
          {t('registriertHinweis')}
        </p>
      )}
      {fehler && <p className="mb-3 text-sm text-danger">⚠ {fehler}</p>}

      {schritt === 'login' && (
        <div className="flex flex-col gap-3">
          <label className="label">
            {t('email')}
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} type="email" />
          </label>
          <label className="label">
            {t('password')}
            <input value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} type="password" />
          </label>
          <button onClick={login} disabled={busy || !email || !password} className="btn btn-primary mt-1">
            {t('anmelden')}
          </button>
        </div>
      )}

      {schritt === 'enroll' && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('enrollTitle')}</h2>
          <p className="text-sm text-muted">{t('enrollHinweis')}</p>
          {qrDataUrl && (
            <div className="flex flex-col items-center gap-2">
              {/* QR-Code zum Scannen in der Authenticator-App */}
              <Image
                src={qrDataUrl}
                alt={t('qrAlt')}
                width={220}
                height={220}
                unoptimized
                className="rounded-lg border border-line bg-white p-2"
              />
              <p className="text-xs text-faint">{t('qrHinweis')}</p>
            </div>
          )}
          <div className="rounded-lg border border-line bg-paper p-3 text-xs break-all">
            <div className="font-medium">{t('manuell')}</div>
            <div className="mt-1">
              {t('secret')}: <code>{secret}</code>
            </div>
          </div>
          <label className="label">
            {t('code')}
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} inputMode="numeric" />
          </label>
          <button onClick={() => code2fa('activate')} disabled={busy || code.length < 6} className="btn btn-accent mt-1">
            {t('bestaetigen')}
          </button>
        </div>
      )}

      {schritt === 'verify' && (
        <div className="flex flex-col gap-3">
          <label className="label">
            {t('code')}
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} inputMode="numeric" autoFocus />
          </label>
          <button onClick={() => code2fa('verify')} disabled={busy || code.length < 6} className="btn btn-accent mt-1">
            {t('bestaetigen')}
          </button>
        </div>
      )}
    </div>
  )
}
