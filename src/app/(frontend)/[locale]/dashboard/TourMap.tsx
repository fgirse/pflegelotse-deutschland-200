'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { minToHHMM } from '@/shared/time'
import { tourFarbe as farbe } from '@/shared/tourfarben'
import type { Einsatz, Tour } from '@/shared/domain'

interface Props {
  tours: Tour[]
  // Nur die Koordinate wird gebraucht — passt für eigene Klienten UND Bedarfe.
  selected: { geo: { lat: number; lng: number } } | null
}

interface Identitaet {
  vorname: string
  nachname: string
  adresse: string
  telefon?: string
}

// HTML-Escape für Nutzerdaten (Name/Adresse) im Popup-HTML.
function esc(v: string): string {
  return v.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  )
}


// Tourenkarte auf Basis von MapLibre GL mit freiem OSM-Raster-Hintergrund
// (kein API-Key nötig). maplibre-gl wird erst im Browser geladen, weil es
// window/document referenziert. Klick auf einen Stopp öffnet ein Popup mit den
// wichtigsten Daten; Name/Adresse (Säule 1) werden autorisiert nachgeladen.
export function TourMap({ tours, selected }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('karte')
  // Labels in einem Ref halten, damit der Karten-Effekt nicht bei jedem Render neu läuft.
  const labelsRef = useRef<Record<string, string>>({})
  labelsRef.current = {
    stopp: t('stopp'),
    name: t('name'),
    adresse: t('adresse'),
    telefon: t('telefon'),
    ankunft: t('ankunft'),
    zeitfenster: t('zeitfenster'),
    dauer: t('dauer'),
    grundzeit: t('grundzeit'),
    qualifikation: t('qualifikation'),
    status: t('status'),
    erledigt: t('erledigt'),
    probe: t('probe'),
    offen: t('offen'),
    laedt: t('laedt'),
    keineIdent: t('keineIdent'),
    min: t('min'),
  }

  useEffect(() => {
    let map: import('maplibre-gl').Map | undefined
    let abgebrochen = false

    ;(async () => {
      const maplibregl = (await import('maplibre-gl')).default
      if (abgebrochen || !containerRef.current) return

      const center = tours[0]?.einsaetze[0]?.geo ?? { lat: 47.995, lng: 7.85 }

      map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap-Mitwirkende',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [center.lng, center.lat],
        zoom: 12,
      })

      map.addControl(new maplibregl.NavigationControl({}), 'top-right')

      // Routenlinie je Tour (Depot → Stopps) — echte Straßenroute (OSRM) oder
      // Luftlinie als Fallback. Layer erst nach dem Laden des Kartenstils.
      map.on('load', () => {
        tours.forEach(async (tour, idx) => {
          try {
            const res = await fetch(`/api/v1/tours/${tour.id}/route`)
            if (!res.ok || abgebrochen || !map) return
            const { geometrie } = (await res.json()) as { geometrie: { lat: number; lng: number }[] }
            if (!Array.isArray(geometrie) || geometrie.length < 2 || !map || abgebrochen) return
            const sid = `route-${idx}`
            if (map.getSource(sid)) return
            map.addSource(sid, {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: geometrie.map((p) => [p.lng, p.lat]) },
              },
            })
            map.addLayer({
              id: sid,
              type: 'line',
              source: sid,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': farbe(idx), 'line-width': 4, 'line-opacity': 0.8 },
            })
          } catch {
            /* Route optional — Marker bleiben. */
          }
        })
      })

      // Ein wiederverwendetes Popup für alle Stopps.
      const popup = new maplibregl.Popup({ offset: 16, closeButton: true, maxWidth: '260px' })

      // Baut den Popup-Inhalt: erst die operativen Stoppdaten, Identität optional.
      const baueHtml = (e: Einsatz, i: number, ident: Identitaet | null, laedt: boolean) => {
        const L = labelsRef.current
        const zeile = (label: string, wert?: string | null) =>
          wert ? `<div><span style="color:#78716c">${label}:</span> ${esc(wert)}</div>` : ''
        const kopf = laedt
          ? `<div style="color:#78716c">${L.name}: ${L.laedt}</div>`
          : ident
            ? zeile(L.name, `${ident.vorname} ${ident.nachname}`.trim()) +
              zeile(L.adresse, ident.adresse) +
              zeile(L.telefon, ident.telefon)
            : `<div style="color:#78716c">${L.keineIdent}</div>`
        const status = e.erledigt ? L.erledigt : e.probe ? L.probe : L.offen
        const dauer = `${e.dauerMin} ${L.min}${e.grundzeitMin ? ` (+${e.grundzeitMin} ${L.grundzeit})` : ''}`
        return (
          `<div style="font:13px/1.4 system-ui,sans-serif;min-width:190px">` +
          `<div style="font-weight:700;margin-bottom:4px">${L.stopp} ${i + 1}</div>` +
          kopf +
          `<hr style="border:none;border-top:1px solid #e7e5e4;margin:6px 0"/>` +
          zeile(L.ankunft, e.ankunft != null ? minToHHMM(e.ankunft) : null) +
          zeile(L.zeitfenster, `${minToHHMM(e.zeitfenster.von)}–${minToHHMM(e.zeitfenster.bis)}`) +
          zeile(L.dauer, dauer) +
          zeile(L.qualifikation, e.qualifikation.join(', ') || undefined) +
          zeile(L.status, status) +
          `</div>`
        )
      }

      // Einsätze je Tour als nummerierte, klickbare Marker — in der Tour-Farbe.
      tours.forEach((tour, tIdx) => {
        const col = farbe(tIdx)
        tour.einsaetze.forEach((e, i) => {
          const el = document.createElement('div')
          el.textContent = String(i + 1)
          el.setAttribute('aria-hidden', 'true')
          el.style.cssText =
            `background:${col};color:#fff;border-radius:9999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;cursor:pointer`
          el.addEventListener('click', async (ev) => {
            ev.stopPropagation()
            if (!map) return
            popup.setLngLat([e.geo.lng, e.geo.lat]).setHTML(baueHtml(e, i, null, true)).addTo(map)
            try {
              const res = await fetch(`/api/v1/klienten/${e.pseudonymId}/identitaet`)
              const ident = res.ok ? ((await res.json()).identitaet as Identitaet) : null
              popup.setHTML(baueHtml(e, i, ident, false))
            } catch {
              popup.setHTML(baueHtml(e, i, null, false))
            }
          })
          new maplibregl.Marker({ element: el }).setLngLat([e.geo.lng, e.geo.lat]).addTo(map!)
        })
      })

      // Ausgewählter Kandidat als hervorgehobener Marker.
      if (selected) {
        const el = document.createElement('div')
        el.textContent = '★'
        el.setAttribute('aria-hidden', 'true')
        el.style.cssText =
          'background:#b45309;color:#fff;border-radius:9999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid #fff'
        new maplibregl.Marker({ element: el })
          .setLngLat([selected.geo.lng, selected.geo.lat])
          .addTo(map!)
      }
    })()

    return () => {
      abgebrochen = true
      map?.remove()
    }
  }, [tours, selected])

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        role="img"
        aria-label="Karte der Touren und Einsätze. Gleichwertige Daten in der Tabellenansicht."
        className="h-[360px] w-full overflow-hidden rounded-lg border border-[var(--color-line)]"
      />
      {/* Legende: welche Farbe gehört zu welcher Tour (Pflegekraft). */}
      {tours.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
          {tours.map((tour, i) => (
            <span key={tour.id} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: farbe(i) }}
                aria-hidden
              />
              {tour.pflegekraftId}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
