import { test, expect } from '@playwright/test'

/**
 * The notification control in Settings.
 *
 * The service's own rules are covered by unit tests; what needs a browser is
 * the part that only a browser can do — permission is only granted from a user
 * gesture, so the switch has to be the thing that asks, and the preference has
 * to survive a reload.
 */
test('the settings switch asks for permission and remembers the answer', async ({ browser }) => {
  const context = await browser.newContext()
  // Grant up front: the prompt itself is the browser's, not the app's.
  await context.grantPermissions(['notifications'], { origin: 'http://localhost:5173' })
  const page = await context.newPage()
  const room = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await page.goto(`/settings?room=${room}`)
  await page.waitForFunction(() => window.db?.sm, null, { timeout: 60_000 })

  // The identity gate covers the page until a session exists.
  await expect(page.locator('.ob-shell')).toBeVisible()
  await page.evaluate(async () => {
    const { mnemonic } = await window.db.sm.startNewUserRegistration()
    await window.db.sm.loginOrRecoverUserWithMnemonic(mnemonic)
  })
  await expect(page.locator('.ob-shell')).toHaveCount(0)

  const toggle = page.getByRole('switch', { name: /Notify me about new messages/i })
  await expect(toggle).toBeVisible()
  await expect(toggle).not.toBeChecked()

  await toggle.click()
  await expect(toggle).toBeChecked()

  // The preference is the app's own, and outlives the page.
  await page.reload()
  await page.waitForFunction(() => window.db?.sm, null, { timeout: 60_000 })
  await expect(page.locator('.ob-shell')).toBeVisible()
  await page.evaluate(async () => {
    const { mnemonic } = await window.db.sm.startNewUserRegistration()
    await window.db.sm.loginOrRecoverUserWithMnemonic(mnemonic)
  })
  await expect(page.locator('.ob-shell')).toHaveCount(0)
  await expect(page.getByRole('switch', { name: /Notify me about new messages/i })).toBeChecked()

  await context.close()
})
