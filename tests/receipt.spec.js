import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'

/**
 * Receipts and the Chain Explorer.
 *
 * The app derives a receipt code from the vote node's id. This suite re-derives
 * the same code independently, in Node, so a change to the app's derivation
 * fails here instead of silently agreeing with itself.
 *
 * Each run opens its own room (`?room=`, development only): storage isolation
 * gives a clean disk, a unique room name is what gives a clean network.
 *
 * Navigation goes through the app's own links rather than `page.goto`. That is
 * what a person does — and a full reload right after a write would race the
 * engine's debounced flush to OPFS, testing the harness instead of the app.
 */

/** The receipt code for a node id, computed without any app code. */
function expectedCode(nodeId) {
  const hex = createHash('sha256').update(nodeId, 'utf8').digest('hex').slice(0, 8).toUpperCase()
  return `${hex.slice(0, 4)}-${hex.slice(4)}`
}

/**
 * Open a signing session.
 *
 * `startNewUserRegistration` mints a volatile identity; the session that signs
 * operations only begins once that phrase is used to sign in — which is also
 * what dismisses the app's identity dialog.
 */
async function signIn(page) {
  await page.waitForFunction(() => window.db?.sm, null, { timeout: 60_000 })
  // Wait for the gate to actually be up before signing in. Asserting only that
  // it is gone races a dialog that has not mounted yet: the assertion passes on
  // an empty page and the modal then appears over whatever the test clicks next.
  await expect(page.locator('.ob-shell')).toBeVisible()
  const address = await page.evaluate(async () => {
    const { mnemonic } = await window.db.sm.startNewUserRegistration()
    await window.db.sm.loginOrRecoverUserWithMnemonic(mnemonic)
    return window.db.sm.getActiveEthAddress()
  })
  await expect(page.locator('.ob-shell')).toHaveCount(0)
  return address
}

/** Cast a vote through the app's own instance, on an open session. */
async function seedVote(page) {
  return page.evaluate(async () => {
    const db = window.db
    const voter = db.sm.getActiveEthAddress()

    const pollId = await db.put({
      type: 'poll',
      question: 'Does the receipt resolve?',
      options: [
        { id: 'opt-yes', text: 'Yes', votes: 0, voters: [] },
        { id: 'opt-no', text: 'No', votes: 0, voters: [] },
      ],
      createdAt: Date.now(),
    })

    const nodeId = `${pollId}:${voter}`
    await db.sm.acls.set(
      { type: 'vote', pollId, optionIds: ['opt-yes'], voter, createdAt: Date.now() },
      nodeId
    )
    return { pollId, voter, nodeId }
  })
}

test.describe('verifiable receipts', () => {
  let room

  test.beforeEach(async ({ page }) => {
    room = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await page.goto(`/?room=${room}`)
    await signIn(page)
  })

  test('the explorer lists the signed vote, and its receipt resolves', async ({ page }) => {
    const { nodeId, voter } = await seedVote(page)
    const code = expectedCode(nodeId)

    await page.getByRole('button', { name: 'Chain Explorer' }).click()

    const entry = page.locator('.ce-entry', { hasText: nodeId })
    await expect(entry).toBeVisible()
    await expect(entry.getByText('vote', { exact: true })).toBeVisible()
    // The hybrid logical clock is what orders operations — it must be real.
    await expect(entry.locator('.ce-hlc')).not.toHaveText('hlc 0.0')
    // The node id carries the voter's address: authorship is structural.
    expect(nodeId).toContain(voter)

    // Follow the receipt the explorer offers, as a person would.
    await entry.getByRole('link', { name: `receipt ${code}` }).click()

    // Scope to the receipt block: Ionic keeps the previous view mounted through
    // the transition, so the explorer's copy of the id is still in the DOM.
    const receipt = page.locator('.rc-result')
    await expect(receipt.getByText('Signature verified · vote intact')).toBeVisible()
    await expect(receipt.getByText('Does the receipt resolve?')).toBeVisible()
    await expect(receipt.getByText('Yes', { exact: true })).toBeVisible()
    await expect(receipt.locator('.rc-node')).toHaveText(nodeId)
  })

  test('an unknown code is reported, never invented', async ({ page }) => {
    await page.goto(`/receipt?room=${room}`)
    await signIn(page)
    const main = page.getByRole('main')

    await main.getByLabel('Receipt code').fill('DEAD-BEEF')
    await main.getByRole('button', { name: 'Check' }).click()

    await expect(main.getByText(/No vote with that code/)).toBeVisible()
    await expect(main.getByText('Signature verified · vote intact')).toHaveCount(0)
  })
})
