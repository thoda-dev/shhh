import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db, sql } from '../utils/database'

/**
 * Applies pending Drizzle migrations at boot so a fresh `docker compose up` needs no manual step.
 * In-process rather than a drizzle-kit call: importing the migrator is what makes Nitro bundle it, which keeps
 * the runtime image down to the server output instead of a second package install.
 * Production only. Set SKIP_MIGRATIONS=true when a separate deployment step handles them.
 */
export default defineNitroPlugin(async () => {
  if (process.env.NODE_ENV !== 'production' || process.env.SKIP_MIGRATIONS === 'true') return

  const migrationsFolder = process.env.MIGRATIONS_DIR ?? './migrations'

  // Arbitrary but fixed key, so two containers starting at once can't both apply the same migration.
  const LOCK_KEY = 4_827_301

  try {
    // Transaction-scoped: a session lock and its unlock are two pool checkouts, and land on different connections.
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_KEY})`)
      // `db`, not `tx`: the migrator opens a transaction of its own on whatever session it is handed.
      await migrate(db, { migrationsFolder })
      console.log('[migrate] database is up to date')
    })
  } catch (error) {
    // Hard stop: serving against a schema the code doesn't expect corrupts data far more quietly than refusing to start.
    console.error('[migrate] migration failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
})
