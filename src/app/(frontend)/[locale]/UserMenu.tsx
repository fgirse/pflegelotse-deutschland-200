'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

type Me = {
  email: string
  role: string
  tenantId?: string
  dienstName?: string
} | null

const DIENST_ROLLEN = ['disponent', 'admin', 'pflegekraft']

// Auth-bewusster Header-Bereich. Lädt den Sitzungsstatus clientseitig über
// /api/v1/auth/me (so bleiben die Marketing-Seiten statisch) und zeigt klar:
// angemeldet als wen, mit Link in den eigenen Bereich und Abmelden.
export function UserMenu({ locale }: { locale: string }) {
  const t = useTranslations()
  const [me, setMe] = useState<Me | undefined>(undefined) // undefined = lädt
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let aktiv = true
    fetch('/api/v1/auth/me')
      .then((r) => r.json())
      .then((d) => aktiv && setMe(d.user ?? null))
      .catch(() => aktiv && setMe(null))
    return () => {
      aktiv = false
    }
  }, [])

  async function abmelden() {
    setBusy(true)
    await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {})
    window.location.href = `/${locale}`
  }

  // Platzhalter mit fester Breite gegen Layout-Sprung während des Ladens.
  if (me === undefined) return <span className="inline-block w-24" aria-hidden />

  // Nicht angemeldet: Anmelden + Registrieren.
  if (!me) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          {t('login.anmelden')}
        </Link>
        <Link href="/registrieren" className="btn btn-accent">
          {t('login.jetztRegistrieren')}
        </Link>
      </div>
    )
  }

  // Angemeldet: Bereichs-Link (rollenabhängig) + Name + Abmelden.
  const istDienst = DIENST_ROLLEN.includes(me.role)
  const bereichHref = istDienst ? '/dashboard' : '/meine-bedarfe'
  const bereichLabel = istDienst ? t('nav.dashboard') : t('meineBedarfe.title')
  const anzeige = me.dienstName || me.email

  return (
    <div className="flex items-center gap-2">
      <Link href={bereichHref} className="btn btn-outline">
        {bereichLabel}
      </Link>
      <span
        className="hidden max-w-[12rem] truncate text-sm text-[var(--color-muted)] md:inline"
        title={me.email}
      >
        {anzeige}
      </span>
      <button
        onClick={abmelden}
        disabled={busy}
        className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        {t('login.abmelden')}
      </button>
    </div>
  )
}
