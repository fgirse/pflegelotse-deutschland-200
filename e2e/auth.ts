import { type Page, expect } from '@playwright/test'
import { totp } from '../src/lib/totp'

// Meldet den Demo-Disponenten an und richtet 2FA frisch ein, sodass der
// Browser-Kontext anschließend ein gültiges Payload- UND 2FA-Cookie hat.
// page.request teilt die Cookies mit dem Seitenkontext.
export async function loginAlsDisponent(page: Page): Promise<void> {
  const login = await page.request.post('/api/v1/auth/login', {
    data: { email: 'disponent@pflegelotse.local', password: 'demo12345' },
  })
  expect(login.ok()).toBeTruthy()

  // Immer frisch einrichten (liefert ein bekanntes Secret) und aktivieren.
  const enroll = await page.request.post('/api/v1/auth/2fa/enroll')
  const { secret } = await enroll.json()
  const code = totp(secret)
  const activate = await page.request.post('/api/v1/auth/2fa/activate', { data: { code } })
  expect(activate.ok()).toBeTruthy()
}
