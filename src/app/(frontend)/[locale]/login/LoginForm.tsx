'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Schritt = 'login' | 'enroll' | 'verify'

// Login mit zweitem Faktor. Reihenfolge: Passwort → (Ersteinrichtung der 2FA
// oder) Code-Bestätigung → Weiterleitung in den Dienst-Bereich.
export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations('login')
  const [schritt, setSchritt] = useState<Schritt>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [secret, setSecret] = useState<string | null>(null)
  const [otpauth, setOtpauth] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const inputCls = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2'
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
        // 2FA erstmalig einrichten.
        const e = await fetch('/api/v1/auth/2fa/enroll', { method: 'POST' })
        const ed = await e.json()
        setSecret(ed.secret)
        setOtpauth(ed.otpauth)
        setSchritt('enroll')
      } else {
        setSchritt('verify')
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
    <div className="mt-6 rounded-lg border bg-white p-5">
      {fehler && <p className="mb-3 text-sm text-red-700">⚠ {fehler}</p>}

      {schritt === 'login' && (
        <div className="flex flex-col gap-3">
          <label className="block text-sm">
            {t('email')}
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} type="email" />
          </label>
          <label className="block text-sm">
            {t('password')}
            <input value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} type="password" />
          </label>
          <button onClick={login} disabled={busy || !email || !password} className="rounded-md bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-50">
            {t('anmelden')}
          </button>
        </div>
      )}

      {schritt === 'enroll' && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('enrollTitle')}</h2>
          <p className="text-sm text-slate-600">{t('enrollHinweis')}</p>
          <div className="rounded-md bg-slate-50 p-3 text-xs break-all">
            <div className="font-medium">{t('secret')}:</div>
            <code>{secret}</code>
            {otpauth && (
              <>
                <div className="mt-2 font-medium">otpauth:</div>
                <code>{otpauth}</code>
              </>
            )}
          </div>
          <label className="block text-sm">
            {t('code')}
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} inputMode="numeric" />
          </label>
          <button onClick={() => code2fa('activate')} disabled={busy || code.length < 6} className="rounded-md bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50">
            {t('bestaetigen')}
          </button>
        </div>
      )}

      {schritt === 'verify' && (
        <div className="flex flex-col gap-3">
          <label className="block text-sm">
            {t('code')}
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} inputMode="numeric" autoFocus />
          </label>
          <button onClick={() => code2fa('verify')} disabled={busy || code.length < 6} className="rounded-md bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50">
            {t('bestaetigen')}
          </button>
        </div>
      )}
    </div>
  )
}
