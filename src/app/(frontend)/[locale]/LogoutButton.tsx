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
      className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
    >
      {t('abmelden')}
    </button>
  )
}
