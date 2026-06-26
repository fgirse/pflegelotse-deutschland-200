import { env } from '@/lib/env'
import { NominatimGeocoder } from './NominatimGeocoder'
import type { GeoTreffer } from './GeocodingProvider'

// Composition Root des Geocodings + einfacher In-Memory-Cache (entlastet den
// Geocoder und respektiert dessen Nutzungslimits).
const geocoder = new NominatimGeocoder(env.NOMINATIM_BASE_URL, env.GEOCODER_USER_AGENT)
const cache = new Map<string, GeoTreffer | null>()

export async function geocode(query: string): Promise<GeoTreffer | null> {
  const key = query.trim().toLowerCase()
  if (cache.has(key)) return cache.get(key) ?? null
  const treffer = await geocoder.geocode(query)
  cache.set(key, treffer)
  return treffer
}
