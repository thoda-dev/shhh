import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Stored in clear, not hashed: the admin panel has to list and manage entries. Operational security data, not user profile data.
export const bannedIps = pgTable('banned_ips', {
  id: uuid('id').defaultRandom().primaryKey(),
  ip: text('ip').notNull().unique(),
  reason: text('reason').notNull(),
  bannedAt: timestamp('banned_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true })
})
