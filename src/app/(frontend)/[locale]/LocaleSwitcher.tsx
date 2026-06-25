'use client'

import { usePathname, useRouter } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

// Schlanker DE/EN-Umschalter: wechselt die Locale unter Beibehaltung des Pfads.
export function LocaleSwitcher({ locale }: { locale: string }) {
  const pathname = usePathname()
  const router = useRouter()
  return (
    <div className="flex items-center gap-1 text-xs font-semibold" role="group" aria-label="Sprache">
      {routing.locales.map((l) => {
        const aktiv = l === locale
        return (
          <button
            key={l}
            onClick={() => router.replace(pathname, { locale: l })}
            aria-pressed={aktiv}
            className={`min-h-9 rounded-md px-2 uppercase transition-colors ${
              aktiv ? 'bg-[var(--color-ink)] text-white' : 'text-[var(--color-muted)] hover:bg-[var(--color-line)]'
            }`}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}
