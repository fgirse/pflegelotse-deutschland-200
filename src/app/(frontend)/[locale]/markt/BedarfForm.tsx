'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { hhmmToMin } from '@/shared/time'

// Freiburger Stadtteile mit Koordinaten — Ersatz für Geocoding in diesem Bau.
const ORTE: Record<string, { lat: number; lng: number }> = {
  Innenstadt: { lat: 47.995, lng: 7.852 },
  Wiehre: { lat: 47.988, lng: 7.851 },
  Herdern: { lat: 48.013, lng: 7.846 },
  Stühlinger: { lat: 47.998, lng: 7.838 },
  Littenweiler: { lat: 47.978, lng: 7.905 },
}

// Zweistufiges Bedarfsformular. Schritt 1: Pflegesituation (operative Daten),
// Schritt 2: Kontakt (PII). Beim Absenden POST /api/v1/bedarfe.
export function BedarfForm() {
  const t = useTranslations('markt')
  const router = useRouter()
  const [schritt, setSchritt] = useState<1 | 2>(1)
  const [fehler, setFehler] = useState<string | null>(null)
  const [sende, setSende] = useState(false)

  // Schritt 1
  const [ort, setOrt] = useState<keyof typeof ORTE>('Wiehre')
  const [pflegegrad, setPflegegrad] = useState(3)
  const [qualifikation, setQualifikation] = useState('grundpflege')
  const [leistungen, setLeistungen] = useState('LK01')
  const [von, setVon] = useState('08:30')
  const [bis, setBis] = useState('10:00')
  const [dauer, setDauer] = useState(30)
  const [express, setExpress] = useState(false)

  // Schritt 2
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [telefon, setTelefon] = useState('')
  const [email, setEmail] = useState('')
  const [adresse, setAdresse] = useState('')

  // Übernimmt einen vom KI-Lotsen vorgeschlagenen Entwurf (via sessionStorage).
  useEffect(() => {
    const roh = sessionStorage.getItem('bedarfEntwurf')
    if (!roh) return
    sessionStorage.removeItem('bedarfEntwurf')
    try {
      const e = JSON.parse(roh)
      if (e.ort && e.ort in ORTE) setOrt(e.ort as keyof typeof ORTE)
      if (typeof e.pflegegrad === 'number') setPflegegrad(e.pflegegrad)
      if (Array.isArray(e.qualifikation) && e.qualifikation[0]) setQualifikation(e.qualifikation[0])
      if (Array.isArray(e.leistungen) && e.leistungen.length) setLeistungen(e.leistungen.join(', '))
      if (e.zeitVon) setVon(e.zeitVon)
      if (e.zeitBis) setBis(e.zeitBis)
      if (typeof e.dauerMin === 'number') setDauer(e.dauerMin)
      if (typeof e.express === 'boolean') setExpress(e.express)
    } catch {
      /* ungültiger Entwurf — ignorieren */
    }
  }, [])

  async function absenden() {
    setSende(true)
    setFehler(null)
    try {
      const res = await fetch('/api/v1/bedarfe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          geo: ORTE[ort],
          pflegegrad,
          qualifikation: [qualifikation],
          leistungen: leistungen.split(',').map((s) => s.trim()).filter(Boolean),
          zeitfenster: { von: hhmmToMin(von), bis: hhmmToMin(bis) },
          dauerMin: dauer,
          express,
          kontakt: { vorname, nachname, telefon, email, adresse },
        }),
      })
      if (!res.ok) throw new Error('Fehler beim Einstellen')
      const data = await res.json()
      router.push(`/markt/${data.bedarfId}`)
    } catch (e) {
      setFehler((e as Error).message)
      setSende(false)
    }
  }

  const inputCls = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2'

  return (
    <div className="mt-6 rounded-lg border bg-white p-5">
      <p className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-900">{t('hinweisAnonym')}</p>

      {schritt === 1 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-semibold">{t('step1')}</h2>
          <label className="block text-sm">
            {t('ort')}
            <select value={ort} onChange={(e) => setOrt(e.target.value as keyof typeof ORTE)} className={inputCls}>
              {Object.keys(ORTE).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {t('pflegegrad')}
            <select value={pflegegrad} onChange={(e) => setPflegegrad(Number(e.target.value))} className={inputCls}>
              {[1, 2, 3, 4, 5].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {t('qualifikation')}
            <select value={qualifikation} onChange={(e) => setQualifikation(e.target.value)} className={inputCls}>
              <option value="grundpflege">{t('grundpflege')}</option>
              <option value="behandlungspflege">{t('behandlungspflege')}</option>
            </select>
          </label>
          <label className="block text-sm">
            {t('leistungen')}
            <input value={leistungen} onChange={(e) => setLeistungen(e.target.value)} className={inputCls} />
          </label>
          <div className="flex gap-3">
            <label className="block flex-1 text-sm">
              {t('zeitVon')}
              <input type="time" value={von} onChange={(e) => setVon(e.target.value)} className={inputCls} />
            </label>
            <label className="block flex-1 text-sm">
              {t('zeitBis')}
              <input type="time" value={bis} onChange={(e) => setBis(e.target.value)} className={inputCls} />
            </label>
            <label className="block w-28 text-sm">
              {t('dauer')}
              <input type="number" value={dauer} onChange={(e) => setDauer(Number(e.target.value))} className={inputCls} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={express} onChange={(e) => setExpress(e.target.checked)} />
            {t('express')}
          </label>
          <button onClick={() => setSchritt(2)} className="rounded-md bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800">
            {t('weiter')}
          </button>
        </div>
      )}

      {schritt === 2 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-semibold">{t('step2')}</h2>
          <label className="block text-sm">{t('vorname')}
            <input value={vorname} onChange={(e) => setVorname(e.target.value)} className={inputCls} />
          </label>
          <label className="block text-sm">{t('nachname')}
            <input value={nachname} onChange={(e) => setNachname(e.target.value)} className={inputCls} />
          </label>
          <label className="block text-sm">{t('telefon')}
            <input value={telefon} onChange={(e) => setTelefon(e.target.value)} className={inputCls} />
          </label>
          <label className="block text-sm">{t('email')}
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </label>
          <label className="block text-sm">{t('adresse')}
            <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className={inputCls} />
          </label>
          {fehler && <p className="text-sm text-red-700">⚠ {fehler}</p>}
          <div className="flex gap-3">
            <button onClick={() => setSchritt(1)} className="rounded-md border px-4 py-2">{t('zurueck')}</button>
            <button
              onClick={absenden}
              disabled={sende || !vorname || !nachname || !telefon}
              className="flex-1 rounded-md bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50"
            >
              {t('absenden')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
