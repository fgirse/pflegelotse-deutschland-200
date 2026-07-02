'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { ORTE } from '@/shared/orte'
import { hhmmToMin } from '@/shared/time'
import { kassenFuerArt, type KostentraegerArt } from '@/shared/krankenkassen'
import { BUNDESLAENDER, type Bundesland } from '@/shared/leistungskomplexe'
import {
  LEISTUNGSGRUPPEN,
  ABWESENHEITEN,
  KONTAKTARTEN,
  lkCodesFuer,
  type LeistungsgruppeKey,
} from '@/shared/leistungsgruppen'

// Auswahlzustand je Leistungsgruppe.
type GruppeState = {
  positionen: string[]
  andere: string
  beschreibung: string
  tageProWoche: string
  malProTag: string
}
const leereGruppe = (): GruppeState => ({
  positionen: [],
  andere: '',
  beschreibung: '',
  tageProWoche: '',
  malProTag: '',
})

// 3-Schritt-Bedarfsformular (Angehörige/Sozialdienste): Kostenträger zuerst,
// dann Person → Dienstleistungen (Klartext + Häufigkeit) → Kontakt.
export function BedarfForm() {
  const t = useTranslations()
  const router = useRouter()
  const [schritt, setSchritt] = useState<1 | 2 | 3>(1)
  const [fehler, setFehler] = useState<string | null>(null)
  const [sende, setSende] = useState(false)

  // Kostenträger (zuerst) + Bundesland
  const [kvArt, setKvArt] = useState<'' | KostentraegerArt>('')
  const [kasse, setKasse] = useState('')
  const [bundesland, setBundesland] = useState<Bundesland>('Baden-Württemberg')

  // Schritt 1 — Person
  const [strasse, setStrasse] = useState('')
  const [hausnummer, setHausnummer] = useState('')
  const [stadtteil, setStadtteil] = useState<keyof typeof ORTE>('Wiehre')
  const [alter, setAlter] = useState('')
  const [wohnsituation, setWohnsituation] = useState<'' | 'alleinlebend' | 'gemeinschaft'>('')
  const [pflegegrad, setPflegegrad] = useState('')
  const [startDatum, setStartDatum] = useState('')
  const [uhrzeitVon, setUhrzeitVon] = useState('')
  const [uhrzeitBis, setUhrzeitBis] = useState('')
  const [abwesenheiten, setAbwesenheiten] = useState<string[]>([])
  const [abwesenheitErlaeuterung, setAbwesenheitErlaeuterung] = useState('')
  const [besonderheiten, setBesonderheiten] = useState('')

  // Schritt 2 — Leistungen je Gruppe
  const [gruppen, setGruppen] = useState<Record<string, GruppeState>>(
    Object.fromEntries(LEISTUNGSGRUPPEN.map((g) => [g.key, leereGruppe()])),
  )

  // Schritt 3 — Kontakt
  const [name, setName] = useState('')
  const [beratungsstelle, setBeratungsstelle] = useState('')
  const [email, setEmail] = useState('')
  const [telefon, setTelefon] = useState('')
  const [kontaktart, setKontaktart] = useState<string[]>([])
  const [kontaktzeitraum, setKontaktzeitraum] = useState('')
  const [datenschutz, setDatenschutz] = useState(false)

  const inputCls = 'input'

  function toggle(list: string[], set: (v: string[]) => void, v: string) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  }
  function setGruppe(key: string, patch: Partial<GruppeState>) {
    setGruppen((g) => ({ ...g, [key]: { ...g[key], ...patch } }))
  }

  const step1Ok = strasse && hausnummer && stadtteil && Number(alter) >= 1 && pflegegrad && startDatum
  const step3Ok = name.trim() && email.trim() && kontaktart.length > 0 && datenschutz

  async function absenden() {
    setSende(true)
    setFehler(null)
    try {
      // Adresse geokodieren (für die Tour); Fallback = Stadtteil-Mittelpunkt.
      let geo = ORTE[stadtteil]
      try {
        const q = `${strasse} ${hausnummer}, ${stadtteil}, Freiburg`
        const res = await fetch(`/api/v1/geo/geocode?q=${encodeURIComponent(q)}`)
        if (res.ok) {
          const d = await res.json()
          if (typeof d.lat === 'number' && typeof d.lng === 'number') geo = { lat: d.lat, lng: d.lng }
        }
      } catch {
        /* Fallback bleibt Stadtteil-Mittelpunkt */
      }

      // Leistungsauswahl strukturiert + legacy-kompatible Ableitungen.
      const leistungsauswahl: Record<string, unknown> = {}
      const lkCodes = new Set<string>()
      const quali = new Set<string>()
      for (const g of LEISTUNGSGRUPPEN) {
        const s = gruppen[g.key]
        const hatInhalt = s.positionen.length || s.andere.trim() || s.beschreibung.trim()
        if (!hatInhalt) continue
        leistungsauswahl[g.key] = {
          positionen: s.positionen,
          andere: s.andere || undefined,
          beschreibung: s.beschreibung || undefined,
          tageProWoche: s.tageProWoche ? Number(s.tageProWoche) : undefined,
          malProTag: s.malProTag ? Number(s.malProTag) : undefined,
        }
        for (const c of lkCodesFuer(g.key as LeistungsgruppeKey, s.positionen, bundesland)) lkCodes.add(c)
        if (g.key === 'medizinisch') quali.add('behandlungspflege')
        else if (g.key === 'koerperpflege' || g.key === 'hauswirtschaft' || g.key === 'begleitung')
          quali.add('grundpflege')
      }

      // Wunsch-Uhrzeit nur senden, wenn beide gesetzt und von ≤ bis.
      let bevorzugteUhrzeit: { von: number; bis: number } | undefined
      if (uhrzeitVon && uhrzeitBis) {
        const von = hhmmToMin(uhrzeitVon)
        const bis = hhmmToMin(uhrzeitBis)
        if (von <= bis) bevorzugteUhrzeit = { von, bis }
      }

      // Vollständigen Namen in Vor-/Nachname aufteilen (Säule-1-Kompatibilität).
      const teile = name.trim().split(/\s+/)
      const vorname = teile[0] || name.trim()
      const nachname = teile.slice(1).join(' ') || vorname

      const res = await fetch('/api/v1/bedarfe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          geo,
          bundesland,
          stadtteil,
          alter: Number(alter),
          wohnsituation: wohnsituation || undefined,
          pflegegrad: Number(pflegegrad),
          startDatum: startDatum || undefined,
          abwesenheiten,
          abwesenheitErlaeuterung: abwesenheitErlaeuterung || undefined,
          besonderheiten: besonderheiten || undefined,
          leistungsauswahl,
          bevorzugteUhrzeit, // Wunsch-Uhrzeit (falls angegeben) → präzises Slotting
          // legacy-kompatibel; Server leitet Zeitfenster/Dauer final ab:
          leistungen: [...lkCodes],
          qualifikation: [...quali],
          zeitfenster: { von: 480, bis: 1080 },
          dauerMin: 30,
          kostentraegerArt: kvArt || undefined,
          krankenversicherer: kasse || undefined,
          kontakt: {
            vorname,
            nachname,
            telefon: telefon || undefined,
            email,
            adresse: `${strasse} ${hausnummer}, ${stadtteil}`,
            beratungsstelle: beratungsstelle || undefined,
            kontaktart,
            kontaktzeitraum: kontaktzeitraum || undefined,
          },
          einwilligung: true,
        }),
      })
      if (!res.ok) throw new Error(t('markt.absendenFehler'))
      const data = await res.json()
      router.push(`/markt/${data.bedarfId}`)
    } catch (e) {
      setFehler((e as Error).message)
      setSende(false)
    }
  }

  return (
    <div className="card mt-6 p-5 sm:p-6">
      <p className="mb-5 rounded-lg bg-[var(--color-accent-soft)] p-3 text-sm text-[var(--color-accent)]">
        {t('markt.hinweisAnonym')}
      </p>

      {/* Schritt-Anzeige */}
      <div className="mb-6 flex items-center justify-center gap-2 text-sm font-semibold">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`flex h-8 w-8 items-center justify-center rounded-full ${
              schritt === n
                ? 'bg-[var(--color-accent-strong)] text-white'
                : 'bg-[var(--color-line)] text-[var(--color-muted)]'
            }`}
          >
            {n}
          </span>
        ))}
      </div>

      {/* ── Kostenträger (immer zuerst sichtbar in Schritt 1) ── */}
      {schritt === 1 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold">{t('markt.kostentraegerArt')}</h2>
          <label className="label">
            {t('markt.kostentraegerArt')}
            <select
              value={kvArt}
              onChange={(e) => {
                setKvArt(e.target.value as '' | KostentraegerArt)
                setKasse('')
              }}
              className={inputCls}
            >
              <option value="">{t('markt.kostentraegerKeineAngabe')}</option>
              <option value="gesetzlich">{t('markt.kostentraegerGesetzlich')}</option>
              <option value="privat">{t('markt.kostentraegerPrivat')}</option>
            </select>
          </label>
          {kvArt && (
            <label className="label">
              {t('markt.krankenversicherer')}
              <select value={kasse} onChange={(e) => setKasse(e.target.value)} className={inputCls}>
                <option value="">{t('markt.krankenversichererWaehlen')}</option>
                {kassenFuerArt(kvArt).map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
          )}
          <label className="label">
            {t('markt.bundesland')}
            <select
              value={bundesland}
              onChange={(e) => setBundesland(e.target.value as Bundesland)}
              className={inputCls}
            >
              {BUNDESLAENDER.map((bl) => (
                <option key={bl} value={bl}>{bl}</option>
              ))}
            </select>
          </label>

          <h2 className="mt-2 font-display text-lg font-semibold">{t('bedarf.personTitel')}</h2>
          <div className="flex gap-3">
            <label className="label flex-1">
              {t('bedarf.strasse')} *
              <input value={strasse} onChange={(e) => setStrasse(e.target.value)} className={inputCls} />
            </label>
            <label className="label w-32">
              {t('bedarf.hausnummer')} *
              <input value={hausnummer} onChange={(e) => setHausnummer(e.target.value)} className={inputCls} />
            </label>
          </div>
          <label className="label">
            {t('bedarf.stadtteil')} *
            <select value={stadtteil} onChange={(e) => setStadtteil(e.target.value)} className={inputCls}>
              {Object.keys(ORTE).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className="label">
            {t('bedarf.alter')} *
            <input
              type="number"
              min={1}
              value={alter}
              onChange={(e) => setAlter(e.target.value)}
              className={inputCls}
            />
          </label>
          <div>
            <span className="label">{t('bedarf.wohnsituation')}</span>
            <div className="mt-1 flex flex-col gap-1">
              {(['alleinlebend', 'gemeinschaft'] as const).map((w) => (
                <label key={w} className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="radio"
                    name="wohnsituation"
                    checked={wohnsituation === w}
                    onChange={() => setWohnsituation(w)}
                    className="h-5 w-5 accent-[var(--color-accent-strong)]"
                  />
                  {t(`bedarf.${w}`)}
                </label>
              ))}
            </div>
          </div>
          <label className="label">
            {t('markt.pflegegrad')} *
            <select value={pflegegrad} onChange={(e) => setPflegegrad(e.target.value)} className={inputCls}>
              <option value="">–</option>
              {[1, 2, 3, 4, 5].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="label">
            {t('bedarf.startDatum')} *
            <input type="date" value={startDatum} onChange={(e) => setStartDatum(e.target.value)} className={inputCls} />
          </label>
          {/* Optionale Wunsch-Uhrzeit — ermöglicht präzises Tour-Slotting. */}
          <div>
            <span className="label">{t('bedarf.uhrzeit')}</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="time"
                aria-label={t('bedarf.uhrzeitVon')}
                value={uhrzeitVon}
                onChange={(e) => setUhrzeitVon(e.target.value)}
                className={inputCls}
              />
              <span className="text-[var(--color-muted)]">–</span>
              <input
                type="time"
                aria-label={t('bedarf.uhrzeitBis')}
                value={uhrzeitBis}
                onChange={(e) => setUhrzeitBis(e.target.value)}
                className={inputCls}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--color-faint)]">{t('bedarf.uhrzeitHinweis')}</p>
          </div>
          <div>
            <span className="label">{t('bedarf.abwesenheiten')}</span>
            <div className="mt-1 flex flex-col">
              {ABWESENHEITEN.map((a) => (
                <label key={a} className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={abwesenheiten.includes(a)}
                    onChange={() => toggle(abwesenheiten, setAbwesenheiten, a)}
                    className="h-5 w-5 accent-[var(--color-accent-strong)]"
                  />
                  {t(`bedarf.abw.${a}`)}
                </label>
              ))}
            </div>
          </div>
          <label className="label">
            {t('bedarf.abwesenheitErlaeuterung')}
            <input
              value={abwesenheitErlaeuterung}
              onChange={(e) => setAbwesenheitErlaeuterung(e.target.value)}
              placeholder={t('bedarf.abwPlatzhalter')}
              className={inputCls}
            />
          </label>
          <label className="label">
            {t('bedarf.besonderheiten')}
            <input
              value={besonderheiten}
              onChange={(e) => setBesonderheiten(e.target.value)}
              placeholder={t('bedarf.besonderheitenPlatzhalter')}
              className={inputCls}
            />
          </label>
          <p className="-mt-2 text-xs text-[var(--color-faint)]">{t('bedarf.freitextHinweis')}</p>

          <button onClick={() => setSchritt(2)} disabled={!step1Ok} className="btn btn-primary">
            {t('bedarf.weiter')}
          </button>
        </div>
      )}

      {/* ── Schritt 2 — Dienstleistungen ── */}
      {schritt === 2 && (
        <div className="flex flex-col gap-6">
          <h2 className="font-display text-lg font-semibold">{t('bedarf.leistungenTitel')}</h2>
          {LEISTUNGSGRUPPEN.map((g) => {
            const s = gruppen[g.key]
            return (
              <div key={g.key} className="rounded-lg border border-[var(--color-line)] p-4">
                <h3 className="font-display font-semibold text-[var(--color-accent)]">{g.titel}</h3>
                {g.nurFreitext ? (
                  <label className="label mt-2">
                    {t('bedarf.begleitungFrage')}
                    <textarea
                      value={s.beschreibung}
                      onChange={(e) => setGruppe(g.key, { beschreibung: e.target.value })}
                      rows={2}
                      className={inputCls}
                    />
                  </label>
                ) : (
                  <div className="mt-2 flex flex-col">
                    {g.positionen.map((p) => (
                      <label key={p.key} className="flex min-h-11 items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={s.positionen.includes(p.key)}
                          onChange={() =>
                            setGruppe(g.key, {
                              positionen: s.positionen.includes(p.key)
                                ? s.positionen.filter((x) => x !== p.key)
                                : [...s.positionen, p.key],
                            })
                          }
                          className="h-5 w-5 shrink-0 accent-[var(--color-accent-strong)]"
                        />
                        {p.label}
                      </label>
                    ))}
                    {g.positionen.length > 0 && (
                      <label className="label mt-2">
                        {t('bedarf.andereLeistungen')}
                        <input
                          value={s.andere}
                          onChange={(e) => setGruppe(g.key, { andere: e.target.value })}
                          className={inputCls}
                        />
                      </label>
                    )}
                  </div>
                )}
                {g.frequenz && (
                  <div className="mt-3 flex gap-3">
                    <label className="label flex-1">
                      {t('bedarf.tageProWoche')}
                      <select
                        value={s.tageProWoche}
                        onChange={(e) => setGruppe(g.key, { tageProWoche: e.target.value })}
                        className={inputCls}
                      >
                        <option value="">–</option>
                        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <label className="label flex-1">
                      {t('bedarf.malProTag')}
                      <select
                        value={s.malProTag}
                        onChange={(e) => setGruppe(g.key, { malProTag: e.target.value })}
                        className={inputCls}
                      >
                        <option value="">–</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </div>
            )
          })}
          <div className="flex gap-3">
            <button onClick={() => setSchritt(1)} className="btn btn-outline">{t('bedarf.zurueck')}</button>
            <button onClick={() => setSchritt(3)} className="btn btn-primary flex-1">{t('bedarf.weiter')}</button>
          </div>
        </div>
      )}

      {/* ── Schritt 3 — Kontakt ── */}
      {schritt === 3 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold">{t('bedarf.kontaktTitel')}</h2>
          <label className="label">
            {t('bedarf.name')} *
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="label">
            {t('bedarf.beratungsstelle')}
            <input value={beratungsstelle} onChange={(e) => setBeratungsstelle(e.target.value)} className={inputCls} />
          </label>
          <label className="label">
            {t('bedarf.email')} *
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </label>
          <label className="label">
            {t('bedarf.telefon')}
            <input value={telefon} onChange={(e) => setTelefon(e.target.value)} className={inputCls} />
          </label>
          <div>
            <span className="label">{t('bedarf.kontaktart')} *</span>
            <div className="mt-1 flex flex-col">
              {KONTAKTARTEN.map((k) => (
                <label key={k} className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={kontaktart.includes(k)}
                    onChange={() => toggle(kontaktart, setKontaktart, k)}
                    className="h-5 w-5 accent-[var(--color-accent-strong)]"
                  />
                  {t(`bedarf.kontaktart_${k}`)}
                </label>
              ))}
            </div>
          </div>
          <label className="label">
            {t('bedarf.kontaktzeitraum')}
            <input value={kontaktzeitraum} onChange={(e) => setKontaktzeitraum(e.target.value)} className={inputCls} />
          </label>
          <label className="flex items-start gap-2 text-sm text-[var(--color-muted)]">
            <input type="checkbox" checked={datenschutz} onChange={(e) => setDatenschutz(e.target.checked)} className="mt-1" />
            <span>
              {t('markt.einwilligungLabel')}{' '}
              <Link href="/datenschutz" className="text-[var(--color-accent)] hover:underline">
                {t('markt.datenschutzLink')}
              </Link>
            </span>
          </label>
          {fehler && <p className="text-sm text-[var(--color-danger)]">⚠ {fehler}</p>}
          <div className="flex gap-3">
            <button onClick={() => setSchritt(2)} className="btn btn-outline">{t('bedarf.zurueck')}</button>
            <button onClick={absenden} disabled={sende || !step3Ok} className="btn btn-accent flex-1">
              {t('bedarf.absenden')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
