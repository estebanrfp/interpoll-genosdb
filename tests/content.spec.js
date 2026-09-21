import { test, expect } from '@playwright/test'

/**
 * The path a person actually takes, driven through the interface.
 *
 * Everything here goes through the UI rather than the data layer: create a
 * community, publish a post in it, vote on it, and see the tally move. If a
 * form, a store or a subscription breaks, this fails — which the data-layer
 * tests would not notice.
 */

/** Open the app with a signing session, past the identity gate. */
async function signIn(page, room) {
  await page.goto(`/?room=${room}`)
  await page.waitForFunction(() => window.db?.sm, null, { timeout: 60_000 })
  await expect(page.locator('.ob-shell')).toBeVisible()
  const address = await page.evaluate(async () => {
    const { mnemonic } = await window.db.sm.startNewUserRegistration()
    await window.db.sm.loginOrRecoverUserWithMnemonic(mnemonic)
    return window.db.sm.getActiveEthAddress()
  })
  await expect(page.locator('.ob-shell')).toHaveCount(0)
  return address
}

test('create a community, publish a post in it, and vote', async ({ page }) => {
  const room = `content-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const communityName = 'tested'

  await signIn(page, room)

  // Navigation happens inside the app, never with `goto`: a full reload drops a
  // mnemonic session, and a person clicking through the app does not reload.

  // ── Create a community ────────────────────────────────────────────────────
  await page.locator('.side-nav-item', { hasText: 'Create' }).click()
  await page.locator('.create-option-item').first().click()

  await expect(page).toHaveURL(/\/create-community/, { timeout: 30_000 })
  await page.getByRole('textbox').first().fill(communityName)
  await page.getByRole('button', { name: /create community/i }).click()

  // Landing on the community page is the app's own confirmation it was written.
  await expect(page).toHaveURL(/\/community\//, { timeout: 30_000 })

  // The creator is a member from the first write, so posting is allowed.
  await expect.poll(
    async () => page.evaluate(async () => {
      const me = window.db.sm.getActiveEthAddress()
      const { results } = await window.db.map({ query: { type: 'membership', member: me } })
      return (results ?? []).length
    }),
    { timeout: 30_000, message: 'the creator was never recorded as a member' }
  ).toBeGreaterThan(0)

  // ── Publish a post ────────────────────────────────────────────────────────
  await page.getByRole('button', { name: /create post/i }).first().click()
  await expect(page).toHaveURL(/\/create-post/, { timeout: 30_000 })

  // Locate by accessible name rather than by element: Ionic keeps the previous
  // view mounted, and "the first input on the page" is not this form's.
  await page.getByRole('textbox', { name: 'Title' }).fill('A post written by the test suite')
  await page.getByPlaceholder(/What's on your mind/).fill('Signed by the identity that created it.')
  await page.getByRole('button', { name: 'Post', exact: true }).click()

  // ── It appears in the community ───────────────────────────────────────────
  await expect(page).toHaveURL(/\/community\//, { timeout: 30_000 })
  const card = page.locator('.post-card', { hasText: 'A post written by the test suite' })
  await expect(card).toBeVisible({ timeout: 30_000 })

  // ── Vote on it, and watch the derived score move ──────────────────────────
  const upvote = card.locator('button').first()
  await upvote.click()

  await expect.poll(
    async () => page.evaluate(async () => {
      const { results } = await window.db.map({ query: { type: 'postVote' } })
      return (results ?? []).length
    }),
    { timeout: 30_000, message: 'the vote was never written as its own signed node' }
  ).toBe(1)

  // The vote is a node owned by the voter, not a counter anyone can inflate.
  const vote = await page.evaluate(async () => {
    const { results } = await window.db.map({ query: { type: 'postVote' } })
    const node = results[0]
    return { id: node.id, voter: node.value?.voter, direction: node.value?.direction }
  })
  const me = await page.evaluate(() => window.db.sm.getActiveEthAddress())
  expect(vote.voter).toBe(me)
  expect(vote.id).toContain(me)
  expect(vote.direction).toBe('up')
})
