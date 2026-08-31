import { defineConfig } from 'vitest/config'

// Separate from vitest.config.ts so `pnpm test` stays a database-free check: these build the app and boot it.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/support/global-setup.ts'],
    // One server and one database for the whole run, truncated between tests.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000
  }
})
