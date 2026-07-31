'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CodeInput } from './CodeInput'
import { PasswortFeld } from '../PasswortFeld'

type Schritt = 'login' | 'passwort' | 'enroll' | 'verify'

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
  // Erzwungener Passwortwechsel: neues Passwort + Wiederholung; die nach dem
  // Wechsel fällige 2FA-Aktion wird aus der Login-Antwort gemerkt.
  const [neuesPw, setNeuesPw] = useState('')
  const [neuesPw2, setNeuesPw2] = useState('')
  const [pendingEnroll, setPendingEnroll] = useState(false)
  const [pendingVerify, setPendingVerify] = useState(false)
  // Rolle aus der Login-Antwort merken — bestimmt später das Ziel nach der 2FA.
  const [role, setRole] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const registriert = params.get('registriert') === '1'

  const inputCls = 'input'
  // Ziel nach erfolgreicher Anmeldung, rollenabhängig: die Pflegekraft geht in
  // ihre mobile Erfassung, Suchende in ihr Bedarfe-Portal, Disponent/Admin ins
  // Dashboard. So landet niemand auf einer für die Rolle unpassenden Startseite.
  const zielFuer = (r: string | null) =>
    r === 'pflegekraft'
      ? `/${locale}/erfassung`
      : r === 'angehoeriger'
        ? `/${locale}/meine-bedarfe`
        : `/${locale}/dashboard`

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
      setRole(data.role ?? null)
      if (data.passwortWechselErforderlich) {
        // Initial-Passwort: erst zwingend wechseln, dann die 2FA (gemerkt).
        setPendingEnroll(Boolean(data.needsEnrollment))
        setPendingVerify(Boolean(data.twoFactorRequired))
        setSchritt('passwort')
        return
      }
      await weiterNach2fa(data.needsEnrollment, data.twoFactorRequired, data.role)
    } finally {
      setBusy(false)
    }
  }

  // Nach Passwort/Login weiter: 2FA einrichten, bestätigen oder direkt ans Ziel.
  async function weiterNach2fa(needsEnroll: boolean, twoFactorReq: boolean, r: string | null) {
    if (needsEnroll) {
      const e = await fetch('/api/v1/auth/2fa/enroll', { method: 'POST' })
      const ed = await e.json()
      setSecret(ed.secret)
      setQrDataUrl(ed.qrDataUrl)
      setSchritt('enroll')
    } else if (twoFactorReq) {
      setSchritt('verify')
    } else {
      // Keine 2FA-Pflicht (Suchende): direkt ans rollenpassende Ziel.
      window.location.href = zielFuer(r)
    }
  }

  // Erzwungener Passwortwechsel nach dem Initial-Login. Das gerade eingegebene
  // Initial-Passwort dient als „aktuelles"; danach geht es zur 2FA.
  async function passwortSetzen() {
    if (neuesPw.length < 8 || neuesPw !== neuesPw2 || busy) return
    setBusy(true)
    setFehler(null)
    try {
      const res = await fetch('/api/v1/auth/passwort', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ aktuellesPasswort: password, neuesPasswort: neuesPw }),
      })
      if (!res.ok) {
        setFehler(t('fehlerPasswort'))
        return
      }
      await weiterNach2fa(pendingEnroll, pendingVerify, role)
    } finally {
      setBusy(false)
    }
  }

  async function code2fa(pfad: 'activate' | 'verify', codeArg?: string) {
    const c = codeArg ?? code
    if (c.length < 6 || busy) return
    setBusy(true)
    setFehler(null)
    try {
      const res = await fetch(`/api/v1/auth/2fa/${pfad}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: c }),
      })
      if (!res.ok) {
        setFehler(t('fehlerCode'))
        setCode('') // Kästchen für neue Eingabe leeren
        return
      }
      window.location.href = zielFuer(role)
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
            <PasswortFeld
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              labelAnzeigen={t('passwortAnzeigen')}
              labelVerbergen={t('passwortVerbergen')}
            />
          </label>
          <button onClick={login} disabled={busy || !email || !password} className="btn btn-primary mt-1">
            {t('anmelden')}
          </button>
        </div>
      )}

      {schritt === 'passwort' && (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">{t('pwWechselTitle')}</h2>
          <p className="text-sm text-muted">{t('pwWechselHinweis')}</p>
          <label className="label">
            {t('pwNeu')}
            <PasswortFeld
              value={neuesPw}
              onChange={setNeuesPw}
              autoComplete="new-password"
              labelAnzeigen={t('passwortAnzeigen')}
              labelVerbergen={t('passwortVerbergen')}
            />
          </label>
          <label className="label">
            {t('pwNeuWdh')}
            <PasswortFeld
              value={neuesPw2}
              onChange={setNeuesPw2}
              autoComplete="new-password"
              labelAnzeigen={t('passwortAnzeigen')}
              labelVerbergen={t('passwortVerbergen')}
            />
          </label>
          {neuesPw2.length > 0 && neuesPw !== neuesPw2 && (
            <p className="text-sm text-danger">{t('pwUngleich')}</p>
          )}
          <button
            onClick={passwortSetzen}
            disabled={busy || neuesPw.length < 8 || neuesPw !== neuesPw2}
            className="btn btn-primary mt-1"
          >
            {t('pwSpeichern')}
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
          <div>
            <span className="label">{t('code')}</span>
            <div className="mt-2">
              <CodeInput
                value={code}
                onChange={setCode}
                onComplete={(v) => code2fa('activate', v)}
                autoFocus
                ariaLabel={t('code')}
              />
            </div>
          </div>
          <button onClick={() => code2fa('activate')} disabled={busy || code.length < 6} className="btn btn-accent mt-1">
            {t('bestaetigen')}
          </button>
        </div>
      )}

      {schritt === 'verify' && (
        <div className="flex flex-col gap-3">
          <div>
            <span className="label">{t('code')}</span>
            <div className="mt-2">
              <CodeInput
                value={code}
                onChange={setCode}
                onComplete={(v) => code2fa('verify', v)}
                autoFocus
                ariaLabel={t('code')}
              />
            </div>
          </div>
          <button onClick={() => code2fa('verify')} disabled={busy || code.length < 6} className="btn btn-accent mt-1">
            {t('bestaetigen')}
          </button>
        </div>
      )}
    </div>
  )
}
