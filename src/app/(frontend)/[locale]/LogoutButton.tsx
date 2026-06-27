'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

// Kleiner Client-Baustein nur für die Abmelde-Interaktion (Cookies löschen +
// zurück zur Startseite). Der restliche Header wird serverseitig gerendert.
export function LogoutButton({ locale }: { locale: string }) {
  const t = useTranslations('login')
  const [busy, setBusy] = useState(false)

  async function abmelden() {
    setBusy(true)
    await fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {})
    window.location.href = `/${locale}`
  }

  return (
    <button
      onClick={abmelden}
      disabled={busy}
      className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-amber-200"
    >
      {t('abmelden')}
    </button>
  )
}
