import { defineConfig } from 'vitest/config'

// Plain Vitest, not `@nuxt/test-utils`: these suites cover pure modules with no Nuxt or Nitro runtime to boot, so they run on every push without a database or a build step.
// Integration tests will need their own setup with a real Postgres — see ROADMAP.md.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Argon2id is intentionally slow, so key derivation tests need more than the 5s default.
    testTimeout: 30_000
  }
})
