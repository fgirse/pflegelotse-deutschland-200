import { test, expect, devices } from '@playwright/test'

// Mobile Navigation (Bottom-Tab-Bar + Hamburger-Schubladenmenü). Öffentlich auf
// der Startseite — keine Anmeldung/DB-Seed nötig (ausgeloggter Zustand).
// Mobiler Viewport (< md), damit Bottom-Bar/Hamburger aktiv sind und die
// Inline-Desktop-Navigation ausgeblendet ist.
test.use({ ...devices['Pixel 7'] })

test.describe('Mobile Navigation', () => {
  test('Bottom-Tab-Bar zeigt die wichtigsten Ziele', async ({ page }) => {
    await page.goto('/de')

    for (const name of ['Start', 'Pflege finden', 'KI-Lotse', 'Mein Bereich']) {
      await expect(page.getByRole('link', { name, exact: true })).toBeVisible()
    }
    // Auf der Startseite ist „Start" der aktive Tab.
    await expect(page.getByRole('link', { name: 'Start', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // Die Inline-Desktop-Navigation ist auf dem Telefon ausgeblendet
    // (display:none → Landmark „Hauptnavigation" nicht im Accessibility-Baum).
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toHaveCount(0)
  })

  test('Aktiver Tab wechselt mit der Route', async ({ page }) => {
    await page.goto('/de/markt')
    await expect(page.getByRole('link', { name: 'Pflege finden', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('link', { name: 'Start', exact: true })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('Hamburger öffnet das Menü mit allen Zielen und Auth-Aktionen', async ({ page }) => {
    await page.goto('/de')
    await page.getByRole('button', { name: 'Menü öffnen' }).click()

    const dialog = page.getByRole('dialog', { name: 'Navigation' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Pflegedienst finden' })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'KI-Pflegelotse' })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Kostenlose Tools' })).toBeVisible()
    // Ausgeloggt: Anmelden + Registrieren sichtbar.
    await expect(dialog.getByRole('link', { name: 'Anmelden' })).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'Registrieren' })).toBeVisible()

    // Esc schließt das Menü.
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('Menü-Link navigiert und schließt das Menü', async ({ page }) => {
    await page.goto('/de')
    await page.getByRole('button', { name: 'Menü öffnen' }).click()

    const dialog = page.getByRole('dialog', { name: 'Navigation' })
    await dialog.getByRole('link', { name: 'Kostenlose Tools' }).click()

    await expect(page).toHaveURL(/\/de\/tools$/)
    await expect(dialog).toBeHidden()
  })
})

// Gegenprobe: Auf dem Desktop ist die Bottom-Bar aus und die Inline-Navigation an.
test.describe('Desktop Navigation', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('Inline-Navigation sichtbar, Bottom-Bar ausgeblendet', async ({ page }) => {
    await page.goto('/de')
    // Inline-Desktop-Navigation sichtbar (auf das Landmark gescoped, da
    // „Kostenlose Tools" auch im Teaser/Footer vorkommt).
    const inlineNav = page.getByRole('navigation', { name: 'Hauptnavigation' })
    await expect(inlineNav.getByRole('link', { name: 'Kostenlose Tools' })).toBeVisible()
    // … und die Telefon-Tab-Bar ist ausgeblendet (Tab „Start" nicht im Baum).
    await expect(page.getByRole('link', { name: 'Start', exact: true })).toHaveCount(0)
    // Hamburger erscheint auf dem Desktop nicht.
    await expect(page.getByRole('button', { name: 'Menü öffnen' })).toHaveCount(0)
  })
})
