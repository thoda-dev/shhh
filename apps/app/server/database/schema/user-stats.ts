import { relations } from 'drizzle-orm'
import { pgTable, text, integer, bigint, timestamp } from 'drizzle-orm/pg-core'
import { users } from './user'

export const userStats = pgTable('user_stats', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  activePastesCount: integer('active_pastes_count').notNull().default(0),
  activeBytesStored: bigint('active_bytes_stored', { mode: 'number' }).notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const userStatsRelations = relations(userStats, ({ one }) => ({
  user: one(users, { fields: [userStats.userId], references: [users.id] })
}))
