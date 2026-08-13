import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// IP stored in clear (not hashed) — needed for an admin panel to list/manage entries.
// Treated as operational security data (GDPR: legitimate interest), not user profile data.
export const bannedIps = pgTable('banned_ips', {
  id: uuid('id').defaultRandom().primaryKey(),
  ip: text('ip').notNull().unique(),
  reason: text('reason').notNull(),
  bannedAt: timestamp('banned_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true })
})
