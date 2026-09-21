import { test, expect } from '@playwright/test'
import { trackPeerConnections, webrtcEvidence } from './webrtc.js'

/**
 * Two peers, no server.
 *
 * This is the claim the whole project rests on, so it is tested the hard way:
 * each peer gets its own BrowserContext — its own OPFS, localStorage and
 * cookies — because two tabs of one context share all of that and would agree
 * with each other without a network. Each run also gets its own room name, so
 * nothing replicates in from a previous run.
 *
 * Nothing is faked. A poll written by A is read by B, a vote cast by B is
 * counted by A, and the browser's own WebRTC statistics are checked afterwards
 * to confirm it travelled over a real connection.
 */

/** Open the app as an independent peer with a signing session. */
async function openPeer(browser, room) {
  const context = await browser.newContext()
  await trackPeerConnections(context)
  const page = await context.newPage()

  await page.goto(`/?room=${room}`)
  await page.waitForFunction(() => window.db?.sm, null, { timeout: 60_000 })
  await expect(page.locator('.ob-shell')).toBeVisible()
  const address = await page.evaluate(async () => {
    const { mnemonic } = await window.db.sm.startNewUserRegistration()
    await window.db.sm.loginOrRecoverUserWithMnemonic(mnemonic)
    return window.db.sm.getActiveEthAddress()
  })
  await expect(page.locator('.ob-shell')).toHaveCount(0)

  return { context, page, address }
}

test.describe('peer to peer', () => {
  test('a poll written by one peer is voted on by another, with no server', async ({ browser }) => {
    const room = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const alice = await openPeer(browser, room)
    const bob = await openPeer(browser, room)

    // Distinct identities — the same phrase in both would be one peer twice.
    expect(alice.address).not.toBe(bob.address)

    // Alice publishes a poll.
    const pollId = await alice.page.evaluate(async () => {
      const db = window.db
      const me = db.sm.getActiveEthAddress()
      const id = `poll-${Date.now()}`
      await db.sm.acls.set({
        type: 'poll', id, communityId: 'c-sync', question: 'Does this cross the network?',
        options: [{ id: 'yes', text: 'Yes' }, { id: 'no', text: 'No' }],
        creatorId: me, authorName: 'alice', createdAt: Date.now(),
        showResultsBeforeVoting: true, allowMultipleChoices: false, isPrivate: false,
      }, id)
      return id
    })

    // Bob sees it arrive. Web-first polling: convergence takes as long as it takes.
    await expect.poll(
      async () => bob.page.evaluate(async id => {
        const { result } = await window.db.get(id)
        return result?.value?.question ?? null
      }, pollId),
      { timeout: 60_000, message: 'the poll never reached the second peer' }
    ).toBe('Does this cross the network?')

    // Bob votes. The node is keyed by his address and signed by his identity.
    await bob.page.evaluate(async id => {
      const db = window.db
      const me = db.sm.getActiveEthAddress()
      await db.sm.acls.set(
        { type: 'vote', pollId: id, optionIds: ['yes'], voter: me, createdAt: Date.now() },
        `${id}:${me}`
      )
    }, pollId)

    // Alice counts it — the tally is derived from vote nodes, never a shared counter.
    await expect.poll(
      async () => alice.page.evaluate(async id => {
        const { results } = await window.db.map({ query: { type: 'vote', pollId: id } })
        return (results ?? []).length
      }, pollId),
      { timeout: 60_000, message: "the vote never reached the poll's author" }
    ).toBe(1)

    const voter = await alice.page.evaluate(async id => {
      const { results } = await window.db.map({ query: { type: 'vote', pollId: id } })
      return results[0]?.value?.voter ?? null
    }, pollId)
    expect(voter).toBe(bob.address)

    // Now prove the transport: the app-level assertions above have passed, so
    // ICE has had time to settle and the statistics are meaningful.
    const evidence = await bob.page.evaluate(() => window.__peerConnections?.length ?? 0)
    expect(evidence).toBeGreaterThan(0)

    const stats = await webrtcEvidence(bob.page)
    expect(stats.succeededPairs, 'no ICE candidate pair ever succeeded').toBeGreaterThan(0)
    expect(stats.bytesSent, 'a connection was negotiated but nothing travelled').toBeGreaterThan(0)
    expect(stats.bytesReceived).toBeGreaterThan(0)

    await alice.context.close()
    await bob.context.close()
  })

  test('a peer that writes while offline converges once it returns', async ({ browser }) => {
    const room = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const alice = await openPeer(browser, room)
    const bob = await openPeer(browser, room)

    // Let them find each other before the line is cut.
    await alice.page.evaluate(async () => {
      await window.db.put({ type: 'marker', at: Date.now() }, 'marker-hello')
    })
    await expect.poll(
      async () => bob.page.evaluate(async () => (await window.db.get('marker-hello')).result?.value?.type ?? null),
      { timeout: 60_000, message: 'the peers never met' }
    ).toBe('marker')

    // Bob goes offline and writes anyway — the graph is local first.
    await bob.context.setOffline(true)
    const postId = await bob.page.evaluate(async () => {
      const db = window.db
      const me = db.sm.getActiveEthAddress()
      const id = `post-offline-${Date.now()}`
      await db.sm.acls.set({
        type: 'post', id, communityId: 'c-sync', authorId: me, authorName: 'bob',
        authorShowRealName: false, title: 'Written with the network down',
        content: 'Stored locally, replicated later.', category: 'technology',
        imageId: '', imageThumbnail: '', createdAt: Date.now(),
      }, id)
      return id
    })

    // It is readable on his own device immediately.
    const offlineRead = await bob.page.evaluate(async id => {
      const { result } = await window.db.get(id)
      return result?.value?.title ?? null
    }, postId)
    expect(offlineRead).toBe('Written with the network down')

    // Back online, it reaches Alice without anyone replaying it by hand.
    await bob.context.setOffline(false)
    await expect.poll(
      async () => alice.page.evaluate(async id => {
        const { result } = await window.db.get(id)
        return result?.value?.title ?? null
      }, postId),
      { timeout: 90_000, message: 'the offline write never converged' }
    ).toBe('Written with the network down')

    await alice.context.close()
    await bob.context.close()
  })
})
