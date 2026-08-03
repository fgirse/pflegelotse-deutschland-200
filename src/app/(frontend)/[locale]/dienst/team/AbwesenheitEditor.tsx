'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AbwesenheitZeile } from '@/shared/abwesenheit'
import type { MitarbeiterZeile } from '@/shared/mitarbeiter'

// Panel zur Pflege der Abwesenheiten (Urlaub/Krankheit) einer Pflegekraft. Lädt
// die Liste beim Öffnen selbst.
export function AbwesenheitEditor({
  mitarbeiter,
  onClose,
}: {
  mitarbeiter: MitarbeiterZeile
  onClose: () => void
}) {
  const t = useTranslations('team')
  const [liste, setListe] = useState<AbwesenheitZeile[]>([])
  const [laedt, setLaedt] = useState(true)
  const [von, setVon] = useState('')
  const [bis, setBis] = useState('')
  const [typ, setTyp] = useState<'urlaub' | 'krankheit' | 'sonstiges'>('urlaub')
  const [notiz, setNotiz] = useState('')
  const [busy, setBusy] = useState(false)
  const [aktionBusy, setAktionBusy] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  const basis = `/api/v1/team/mitarbeiter/${mitarbeiter.id}/abwesenheiten`

  useEffect(() => {
    let aktiv = true
    ;(async () => {
      try {
        const res = await fetch(basis)
        if (res.ok && aktiv) setListe(((await res.json()).abwesenheiten as AbwesenheitZeile[]) ?? [])
      } catch {
        /* leer lassen */
      } finally {
        if (aktiv) setLaedt(false)
      }
    })()
    return () => {
      aktiv = false
    }
  }, [basis])

  const gueltig = /^\d{4}-\d{2}-\d{2}$/.test(von) && /^\d{4}-\d{2}-\d{2}$/.test(bis) && bis >= von

  async function hinzufuegen() {
    if (!gueltig || busy) return
    setBusy(true)
    setFehler(null)
    try {
      const res = await fetch(basis, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ von, bis, typ, ...(notiz.trim() ? { notiz: notiz.trim() } : {}) }),
      })
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      const { abwesenheit } = (await res.json()) as { abwesenheit: AbwesenheitZeile }
      setListe((l) => [...l, abwesenheit].sort((a, b) => a.von.localeCompare(b.von)))
      setVon('')
      setBis('')
      setNotiz('')
      setTyp('urlaub')
    } catch {
      setFehler(t('fehlerAllgemein'))
    } finally {
      setBusy(false)
    }
  }

  async function loeschen(a: AbwesenheitZeile) {
    if (aktionBusy) return
    setAktionBusy(a.id)
    setFehler(null)
    try {
      const res = await fetch(`${basis}/${a.id}`, { method: 'DELETE' })
      if (!res.ok) {
        setFehler(t('fehlerAllgemein'))
        return
      }
      setListe((l) => l.filter((x) => x.id !== a.id))
    } catch {
      setFehler(t('fehlerAllgemein'))
    } finally {
      setAktionBusy(null)
    }
  }

  const typLabel = (x: string) =>
    t(x === 'urlaub' ? 'abwTypUrlaub' : x === 'krankheit' ? 'abwTypKrankheit' : 'abwTypSonstiges')

  return (
    <section className="card border-2 border-[var(--color-accent)] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">
          {t('abwTitel', { email: mitarbeiter.email })}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-[var(--color-muted)] hover:underline"
        >
          {t('schliessen')}
        </button>
      </div>
      {fehler && <p className="mt-3 text-sm text-danger">⚠ {fehler}</p>}

      {/* Neuen Zeitraum hinzufügen */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="label">
          {t('abwVon')}
          <input type="date" className="input" value={von} onChange={(e) => setVon(e.target.value)} />
        </label>
        <label className="label">
          {t('abwBis')}
          <input type="date" className="input" value={bis} onChange={(e) => setBis(e.target.value)} />
        </label>
        <label className="label">
          {t('abwTyp')}
          <select
            className="input"
            value={typ}
            onChange={(e) => setTyp(e.target.value as typeof typ)}
          >
            <option value="urlaub">{t('abwTypUrlaub')}</option>
            <option value="krankheit">{t('abwTypKrankheit')}</option>
            <option value="sonstiges">{t('abwTypSonstiges')}</option>
          </select>
        </label>
        <label className="label">
          {t('abwNotiz')}
          <input className="input" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
        </label>
      </div>
      <button onClick={hinzufuegen} disabled={busy || !gueltig} className="btn btn-primary mt-3">
        {t('abwHinzufuegen')}
      </button>

      {/* Liste */}
      <div className="mt-5">
        {laedt ? null : liste.length === 0 ? (
          <p className="text-sm text-[var(--color-faint)]">{t('abwLeer')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {liste.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] pb-2 text-sm last:border-0"
              >
                <span>
                  <strong>
                    {a.von} – {a.bis}
                  </strong>{' '}
                  · {typLabel(a.typ)}
                  {a.notiz ? ` · ${a.notiz}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => loeschen(a)}
                  disabled={aktionBusy === a.id}
                  className="shrink-0 font-medium text-[var(--color-danger)] hover:underline disabled:opacity-50"
                >
                  {t('abwLoeschen')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
