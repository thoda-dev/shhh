import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

/** A database of its own, never `DATABASE_URL`: the harness drops its schema on every run. */
export function testDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set. Integration tests need a database of their own — they drop its schema on every run.\n'
      + 'e.g. TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/shhh_test'
    )
  }
  return url
}

/** Cloudflare's always-passes pair, so creating a paste still goes through the real verification. */
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'
export const TURNSTILE_TEST_SECRET_KEY = '1x0000000000000000000000000000000AA'

/** Any string passes with the always-passes secret. */
export const TURNSTILE_TEST_TOKEN = 'integration-test-token'

/** The environment the server under test boots with. */
export function serverEnv(port: number) {
  return {
    NODE_ENV: 'production',
    NITRO_PORT: String(port),
    PORT: String(port),
    HOST: '127.0.0.1',
    DATABASE_URL: testDatabaseUrl(),
    // The boot plugin's default `./migrations` only exists inside the Docker image.
    MIGRATIONS_DIR: resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../server/database/migrations'),
    BETTER_AUTH_SECRET: randomBytes(32).toString('base64'),
    BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
    NUXT_PUBLIC_TURNSTILE_SITE_KEY: TURNSTILE_TEST_SITE_KEY,
    NUXT_TURNSTILE_SECRET_KEY: TURNSTILE_TEST_SECRET_KEY,
    // A supported configuration, and the only one where sign-up doesn't wait on a verification click.
    MAIL_PROVIDER: 'none',
    // Keeps our own abuse controls on the loopback address, which `ip-sec.ts` skips.
    TRUSTED_PROXY_DEPTH: '0'
  }
}
