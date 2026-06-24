import type { Geo } from '@/shared/domain'
import type { RoutingProvider } from '@/server/routing/RoutingProvider'

// Cache für Reisezeit-Matrizen. Die interaktive Antwortzeit (< 1 s, /F220/)
// hängt daran, dass dieselben Punktmengen nicht wiederholt berechnet werden.
// Interface bewusst schlank, damit später Redis dahinter kann.
export interface MatrixCache {
  get(key: string): number[][] | undefined
  set(key: string, matrix: number[][]): void
}

// Einfacher In-Memory-Cache (Dev/Single-Instance).
export class InMemoryMatrixCache implements MatrixCache {
  private store = new Map<string, number[][]>()
  get(key: string) {
    return this.store.get(key)
  }
  set(key: string, matrix: number[][]) {
    this.store.set(key, matrix)
  }
}

// Umhüllt einen RoutingProvider mit einem Cache. Der Schlüssel ist die auf
// ~11 m gerundete Punktfolge — identische Geometrie trifft den Cache.
export class CachedRoutingProvider implements RoutingProvider {
  constructor(
    private readonly inner: RoutingProvider,
    private readonly cache: MatrixCache,
  ) {}

  async travelMatrix(points: Geo[]): Promise<number[][]> {
    const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|')
    const hit = this.cache.get(key)
    if (hit) return hit
    const matrix = await this.inner.travelMatrix(points)
    this.cache.set(key, matrix)
    return matrix
  }
}
