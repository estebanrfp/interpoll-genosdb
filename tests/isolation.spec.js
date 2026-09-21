import { test, expect } from '@playwright/test'

/**
 * A platform check, not a feature test.
 *
 * Every multi-peer test here assumes one BrowserContext is one device. Playwright
 * documents that isolation for cookies, localStorage, sessionStorage and
 * IndexedDB — but not for OPFS, which is exactly where GenosDB keeps the graph.
 * It does isolate it today; because it is undocumented, this asserts it rather
 * than trusting it, so a browser update that changes it fails loudly here
 * instead of quietly invalidating every other result in the suite.
 */

/** Write a file into this context's OPFS root. */
async function writeToOpfs(page, name, contents) {
  return page.evaluate(async ([fileName, body]) => {
    const root = await navigator.storage.getDirectory()
    const handle = await root.getFileHandle(fileName, { create: true })
    const writable = await handle.createWritable()
    await writable.write(body)
    await writable.close()
    return true
  }, [name, contents])
}

/** Read it back, or null when this context cannot see it. */
async function readFromOpfs(page, name) {
  return page.evaluate(async fileName => {
    try {
      const root = await navigator.storage.getDirectory()
      const handle = await root.getFileHandle(fileName)
      return await (await handle.getFile()).text()
    } catch {
      return null
    }
  }, name)
}

test('OPFS is isolated between browser contexts, and shared between tabs of one', async ({ browser }) => {
  const marker = `isolation-${Date.now()}.txt`

  const first = await browser.newContext()
  const firstPage = await first.newPage()
  await firstPage.goto('/')
  await writeToOpfs(firstPage, marker, 'written by the first context')

  // A second context is a second device: it must not see that file.
  const second = await browser.newContext()
  const secondPage = await second.newPage()
  await secondPage.goto('/')
  expect(
    await readFromOpfs(secondPage, marker),
    'OPFS leaked between contexts — every multi-peer result in this suite would be void'
  ).toBeNull()

  // A second tab of the FIRST context is the same device, and must see it.
  const sameDeviceTab = await first.newPage()
  await sameDeviceTab.goto('/')
  expect(await readFromOpfs(sameDeviceTab, marker)).toBe('written by the first context')

  await first.close()
  await second.close()
})
