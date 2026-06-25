import { describe, it, expect } from 'vitest'
import { scrubEvent, scrubBreadcrumb } from './sentry-options'
import type { Event, Breadcrumb } from '@sentry/nextjs'

// Sichert die Datenschutz-Garantie ab: vor dem Versand an Sentry darf keine
// PII durchgehen (Request-Body, Cookies, Auth-Header, Query-String, Nutzer).
describe('scrubEvent', () => {
  it('entfernt Body, Cookies, Auth-Header und Nutzeridentität', () => {
    const event: Event = {
      request: {
        url: 'https://app.example.de/api/v1/ki/chat?token=geheim&id=123',
        data: { nachricht: 'Frau Müller braucht Hilfe beim Waschen' },
        cookies: { pl_2fa: 'abc' },
        headers: { authorization: 'Bearer xyz', Cookie: 'session=1', 'user-agent': 'x' },
      },
      user: { email: 'klient@example.de', ip_address: '1.2.3.4' },
    }
    const out = scrubEvent(event)
    expect(out.request?.data).toBeUndefined()
    expect(out.request?.cookies).toBeUndefined()
    expect(out.user).toBeUndefined()
    const headers = out.request?.headers as Record<string, string>
    expect(headers.authorization).toBeUndefined()
    expect(headers.Cookie).toBeUndefined()
    // Unbedenkliche Header bleiben erhalten.
    expect(headers['user-agent']).toBe('x')
    // Query-String abgeschnitten, Pfad bleibt.
    expect(out.request?.url).toBe('https://app.example.de/api/v1/ki/chat')
  })

  it('ist robust, wenn kein request/user vorhanden ist', () => {
    expect(() => scrubEvent({} as Event)).not.toThrow()
  })
})

describe('scrubBreadcrumb', () => {
  it('verwirft Konsolen-Breadcrumbs', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'leak' } as Breadcrumb)).toBeNull()
  })

  it('entfernt den Body aus HTTP-Breadcrumbs', () => {
    const crumb = { category: 'fetch', data: { url: '/x', body: 'geheim' } } as Breadcrumb
    const out = scrubBreadcrumb(crumb)
    expect(out?.data?.body).toBeUndefined()
    expect(out?.data?.url).toBe('/x')
  })
})
