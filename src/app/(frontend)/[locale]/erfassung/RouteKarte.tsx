'use client'

import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'

interface Stopp {
  geo: { lat: number; lng: number }
}

// Schlanke Routen-Karte für die Pflegekraft: nummerierte Stopps + verbindende
// Route (echte Straßenroute via OSRM, sonst Luftlinie). Pseudonym, kein PII.
// Offline lädt der Kartenhintergrund nicht — die Liste bleibt die Hauptansicht.
export function RouteKarte({
  tourId,
  stopps,
  farbe = '#b45309',
}: {
  tourId: string
  stopps: Stopp[]
  farbe?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (stopps.length === 0) return
    let map: import('maplibre-gl').Map | undefined
    let abgebrochen = false

    ;(async () => {
      const maplibregl = (await import('maplibre-gl')).default
      if (abgebrochen || !containerRef.current) return

      const center = stopps[0].geo
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

      // Route (Depot → Stopps) nach dem Laden des Stils zeichnen.
      map.on('load', async () => {
        try {
          const res = await fetch(`/api/v1/tours/${tourId}/route`)
          if (!res.ok || abgebrochen || !map) return
          const { geometrie } = (await res.json()) as { geometrie: { lat: number; lng: number }[] }
          if (!Array.isArray(geometrie) || geometrie.length < 2 || !map || abgebrochen) return
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: geometrie.map((p) => [p.lng, p.lat]) },
            },
          })
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': farbe, 'line-width': 4, 'line-opacity': 0.8 },
          })
        } catch {
          /* Route optional. */
        }
      })

      // Nummerierte Stopp-Marker.
      stopps.forEach((s, i) => {
        const el = document.createElement('div')
        el.textContent = String(i + 1)
        el.setAttribute('aria-hidden', 'true')
        el.style.cssText =
          `background:${farbe};color:#fff;border-radius:9999px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff`
        new maplibregl.Marker({ element: el }).setLngLat([s.geo.lng, s.geo.lat]).addTo(map!)
      })
    })()

    return () => {
      abgebrochen = true
      map?.remove()
    }
  }, [tourId, stopps, farbe])

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Karte der Tagesroute. Die Stopp-Liste darunter ist gleichwertig."
      className="h-[240px] w-full overflow-hidden rounded-lg border border-[var(--color-line)]"
    />
  )
}
