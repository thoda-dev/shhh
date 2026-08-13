import { sql } from 'drizzle-orm'
import { pgTable, integer, bigint, timestamp, check } from 'drizzle-orm/pg-core'

// Singleton row (id always = 1) — instance-wide denormalized counters.
export const appStats = pgTable(
  'app_stats',
  {
    id: integer('id').primaryKey().default(1),
    activePastesCountAnonymous: integer('active_pastes_count_anonymous').notNull().default(0),
    activePastesCountAuthenticated: integer('active_pastes_count_authenticated')
      .notNull()
      .default(0),
    activeBytesStored: bigint('active_bytes_stored', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [check('app_stats_singleton_check', sql`${table.id} = 1`)],
)
