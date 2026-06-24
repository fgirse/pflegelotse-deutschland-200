'use client'

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { KlientOperativ, Tour } from '@/shared/domain'

interface Props {
  tours: Tour[]
  selected: KlientOperativ | null
}

// Tourenkarte auf Basis von MapLibre GL mit freiem OSM-Raster-Hintergrund
// (kein API-Key nötig). maplibre-gl wird erst im Browser geladen, weil es
// window/document referenziert. Die Karte ist eine visuelle Hilfe — die
// gleichwertige Tabellenalternative steht im Umschalter daneben (/Q400/).
export function TourMap({ tours, selected }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let map: import('maplibre-gl').Map | undefined
    let abgebrochen = false

    ;(async () => {
      const maplibregl = (await import('maplibre-gl')).default
      if (abgebrochen || !containerRef.current) return

      // Mittelpunkt: erster Einsatz oder Freiburg-Zentrum.
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

      // Einsätze je Tour als nummerierte Marker.
      tours.forEach((tour) => {
        tour.einsaetze.forEach((e, i) => {
          const el = document.createElement('div')
          el.textContent = String(i + 1)
          el.setAttribute('aria-hidden', 'true')
          el.style.cssText =
            'background:#1d4ed8;color:#fff;border-radius:9999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff'
          new maplibregl.Marker({ element: el })
            .setLngLat([e.geo.lng, e.geo.lat])
            .addTo(map!)
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
    <div
      ref={containerRef}
      role="img"
      aria-label="Karte der Touren und Einsätze. Gleichwertige Daten in der Tabellenansicht."
      className="h-[360px] w-full overflow-hidden rounded-md border"
    />
  )
}
