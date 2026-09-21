import { test, expect } from '@playwright/test'

/**
 * Categories in the sidebar and the trending panel.
 *
 * The counts are derived from the nodes this replica holds rather than fetched
 * from a relay, so the thing worth pinning is that they follow the data: a post
 * written without a category has to land in `Other` and still be counted, and
 * picking a category has to narrow the feed to exactly that category.
 */

/** Open a session and write a community plus categorised content into it. */
async function seedContent(page) {
  return page.evaluate(async () => {
    const db = window.db
    const { mnemonic } = await db.sm.startNewUserRegistration()
    await db.sm.loginOrRecoverUserWithMnemonic(mnemonic)
    const me = db.sm.getActiveEthAddress()
    const now = Date.now()
    const communityId = 'c-p2p'

    await db.sm.acls.set({
      type: 'community', id: communityId, name: 'p2p', displayName: 'Peer to Peer',
      description: '', rules: [], creatorId: me, createdAt: now, postCount: 0, moderators: [],
    }, communityId)
    await db.sm.acls.set(
      { type: 'membership', communityId, member: me, joinedAt: now },
      `member:${communityId}:${me}`
    )

    const posts = [
      ['technology', 'Signed and verified'],
      ['technology', 'The relay set heals itself'],
      ['science', 'Hybrid logical clocks'],
      ['', 'Written before categories existed'],
    ]
    let index = 0
    for (const [category, title] of posts) {
      const id = `post-${now}-${index++}`
      await db.sm.acls.set({
        type: 'post', id, communityId, authorId: me, authorName: 'tester',
        authorShowRealName: false, title, content: 'body', category,
        imageId: '', imageThumbnail: '', createdAt: Date.now(),
      }, id)
    }
  })
}

test('the sidebar filters the feed and trending counts follow the data', async ({ page }) => {
  const room = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await page.goto(`/?room=${room}`)
  await page.waitForFunction(() => window.db?.sm, null, { timeout: 60_000 })
  await expect(page.locator('.ob-shell')).toBeVisible()
  await seedContent(page)
  await expect(page.locator('.ob-shell')).toHaveCount(0)

  // Reload so the feed subscribes with the content already present, then sign in
  // again — a mnemonic session does not survive a reload.
  await page.waitForTimeout(2000)
  await page.reload()
  await page.waitForFunction(() => window.db?.sm, null, { timeout: 60_000 })
  await expect(page.locator('.ob-shell')).toBeVisible()
  await page.evaluate(async () => {
    const { mnemonic } = await window.db.sm.startNewUserRegistration()
    await window.db.sm.loginOrRecoverUserWithMnemonic(mnemonic)
  })
  await expect(page.locator('.ob-shell')).toHaveCount(0)

  await page.getByText('Latest', { exact: true }).click()
  await expect(page.locator('.post-card')).toHaveCount(4)

  // Trending reflects what is held: two Technology, and the uncategorised post
  // counted under Other rather than dropped.
  const trending = page.locator('.sidebar-trending-row')
  await expect(trending.filter({ hasText: 'Technology' })).toContainText('2')
  await expect(trending.filter({ hasText: 'Other' })).toContainText('1')

  // Choosing a category narrows the feed to exactly that category.
  await page.locator('.side-nav-category', { hasText: 'Technology' }).click()
  await expect(page.locator('.post-card')).toHaveCount(2)
  await expect(page.locator('.post-title').first()).toHaveText(/Signed and verified|relay set heals/)

  // Choosing it again clears the filter.
  await page.locator('.side-nav-category', { hasText: 'Technology' }).click()
  await expect(page.locator('.post-card')).toHaveCount(4)
})
