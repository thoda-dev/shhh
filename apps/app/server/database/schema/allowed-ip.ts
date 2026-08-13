import { relations } from 'drizzle-orm'
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './user'

// Whitelist that bypasses the ip-sec middleware entirely (project.md section 6) — e.g. for
// admins/offices behind a shared IP that would otherwise trip bot/probe detection.
export const allowedIps = pgTable('allowed_ips', {
  id: uuid('id').defaultRandom().primaryKey(),
  ip: text('ip').notNull().unique(),
  label: text('label'),
  addedBy: text('added_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const allowedIpsRelations = relations(allowedIps, ({ one }) => ({
  addedByUser: one(users, { fields: [allowedIps.addedBy], references: [users.id] })
}))
