import { defineConfig } from '@playwright/test'

/**
 * End-to-end suite.
 *
 * Serial by design: the specs share a signalling network, and GenosDB peers
 * converge on their own schedule. Assertions are web-first so they retry while
 * that happens instead of sleeping; `expect.timeout` is generous because P2P
 * convergence means relay discovery first, then governance cycles.
 */
export default defineConfig({
  testDir: './tests',
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
