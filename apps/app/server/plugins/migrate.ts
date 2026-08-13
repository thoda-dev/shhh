import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db, sql } from '../utils/database'

/**
 * Applies pending Drizzle migrations at boot so a fresh `docker compose up` needs no manual step
 * (project.md section 12).
 *
 * Runs in-process rather than from a drizzle-kit call in the container entrypoint: Nitro tree-shakes
 * its output down to what the app actually imports, and the pnpm workspace resolves binaries through
 * a store at the monorepo root — shipping the CLI would mean dragging either the whole dev
 * dependency tree or a second package install into the runtime image. Importing the migrator here is
 * what makes Nitro bundle it, and it keeps the runtime image to the server output alone.
 *
 * Production only, so `pnpm dev` keeps using the explicit `pnpm db:migrate`. Set SKIP_MIGRATIONS=true
 * to opt out when migrations are handled by a separate deployment step.
 */
export default defineNitroPlugin(async () => {
  if (process.env.NODE_ENV !== 'production' || process.env.SKIP_MIGRATIONS === 'true') return

  const migrationsFolder = process.env.MIGRATIONS_DIR ?? './migrations'

  // Arbitrary but fixed key: two containers starting at once would otherwise both try to apply the
  // same migration. The lock is session-scoped, so a crashed process releases it when its connection
  // drops rather than deadlocking every later boot.
  const LOCK_KEY = 4_827_301

  try {
    await db.execute(sql`select pg_advisory_lock(${LOCK_KEY})`)
    try {
      await migrate(db, { migrationsFolder })
      console.log('[migrate] database is up to date')
    } finally {
      await db.execute(sql`select pg_advisory_unlock(${LOCK_KEY})`)
    }
  } catch (error) {
    // Hard stop: serving requests against a schema the code doesn't expect corrupts data far more
    // quietly than refusing to start does.
    console.error('[migrate] migration failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
})
