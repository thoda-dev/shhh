import { defineConfig } from 'vitest/config'

// Deliberately plain Vitest, not `@nuxt/test-utils`: these suites cover pure modules that pull in
// no Nuxt or Nitro runtime, so there is nothing to boot. That keeps them fast enough to run on
// every push without a database or a build step. Integration tests, when they arrive, will need
// their own setup with a real Postgres — see ROADMAP.md.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Argon2id is intentionally slow (OWASP interactive parameters), so key derivation tests
    // need more than the 5s default.
    testTimeout: 30_000
  }
})
