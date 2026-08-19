import { relations } from 'drizzle-orm'
import { pgTable, text, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './user'

export const adminAuditLog = pgTable('admin_audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  targetId: text('target_id'),
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const adminAuditLogRelations = relations(adminAuditLog, ({ one }) => ({
  actor: one(users, { fields: [adminAuditLog.actorId], references: [users.id] })
}))
