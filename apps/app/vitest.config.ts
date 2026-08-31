import { defineConfig } from 'vitest/config'

// Plain Vitest, not `@nuxt/test-utils`: these suites cover pure modules with no Nuxt or Nitro runtime to boot, so they run on every push without a database or a build step.
// The routes are covered against a real Postgres in vitest.integration.config.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integration tests have a config of their own: they need a build and a database.
    exclude: ['tests/integration/**'],
    // Argon2id is intentionally slow, so key derivation tests need more than the 5s default.
    testTimeout: 30_000
  }
})
