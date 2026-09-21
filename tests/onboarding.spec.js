import { test, expect } from '@playwright/test'

/**
 * The three-step welcome: network, spaces, identity.
 *
 * The order matters and is worth pinning: identity comes last, so the spaces a
 * person picks in step 2 are chosen before any key exists. A membership is a
 * signed node, so those joins can only be written once the session opens — if
 * that wiring breaks, the picker silently does nothing, which is exactly the
 * kind of failure nobody notices by hand.
 */

/** Seed public spaces without holding a session afterwards, so the gate still shows. */
async function seedSpaces(page, names) {
  await page.evaluate(async list => {
    const db = window.db
    const { mnemonic } = await db.sm.startNewUserRegistration()
    await db.sm.loginOrRecoverUserWithMnemonic(mnemonic)
    const me = db.sm.getActiveEthAddress()
    for (const [id, displayName] of list) {
      await db.sm.acls.set({
        type: 'community', id, name: id.slice(2), displayName, description: '', rules: [],
        creatorId: me, createdAt: Date.now(), postCount: 0, moderators: [],
      }, id)
    }
    await db.sm.clearSecurity()
  }, names)
}

test.describe('onboarding', () => {
  let room

  test.beforeEach(async ({ page }) => {
    room = `ob-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await page.goto(`/?room=${room}`)
    await page.waitForFunction(() => window.db?.sm, null, { timeout: 60_000 })
  })

  test('walks network → spaces → identity, and joins what was picked', async ({ page }) => {
    await seedSpaces(page, [['c-p2p', 'Peer to Peer'], ['c-governance', 'Governance']])
    await page.reload()
    await page.waitForFunction(() => window.db?.sm, null, { timeout: 60_000 })

    const shell = page.locator('.ob-shell')
    await expect(shell).toBeVisible()

    // Step 1 — the network step states there is nothing to choose.
    await expect(shell.getByText('How do you want to connect?')).toBeVisible()
    await expect(shell.getByText(/no relay to choose/i)).toBeVisible()
    await shell.getByRole('button', { name: 'Continue' }).click()

    // Step 2 — pick a space.
    await expect(shell.getByText('Pick spaces to follow')).toBeVisible()
    await shell.locator('.ob-community-chip', { hasText: 'Peer to Peer' }).click()
    await expect(shell.getByText('1 space selected')).toBeVisible()
    await shell.getByRole('button', { name: 'Continue' }).click()

    // Step 3 — identity, which is what finally opens the session.
    await expect(shell.getByText('Your identity')).toBeVisible()
    await shell.getByRole('button', { name: 'Generate new identity' }).click()
    await expect(shell.getByText(/Save this phrase/)).toBeVisible()
    await shell.getByRole('button', { name: 'Enter Interpoll' }).click()

    await expect(page.locator('.ob-shell')).toHaveCount(0)

    // The picked space was joined by the identity that just came into being.
    const membership = await page.evaluate(async () => {
      const me = window.db.sm.getActiveEthAddress()
      const { result } = await window.db.get(`member:c-p2p:${me}`)
      return { me, type: result?.value?.type ?? null, member: result?.value?.member ?? null }
    })
    expect(membership.type).toBe('membership')
    expect(membership.member).toBe(membership.me)
  })

  test('refuses to enter without a real phrase', async ({ page }) => {
    const shell = page.locator('.ob-shell')
    await shell.getByRole('button', { name: 'Skip' }).click()

    await expect(shell.getByText('Your identity')).toBeVisible()
    await shell.getByRole('button', { name: 'Enter Interpoll' }).click()

    await expect(shell.getByText(/Enter your 12-word recovery phrase/)).toBeVisible()
    await expect(shell).toBeVisible()
  })
})
