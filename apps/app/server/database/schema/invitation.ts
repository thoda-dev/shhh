import { relations, sql } from 'drizzle-orm'
import { pgTable, pgEnum, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './user'

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'expired',
  'revoked',
])

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull(),
    token: text('token').notNull().unique(),
    invitedBy: text('invited_by').references(() => users.id, { onDelete: 'set null' }),
    status: invitationStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  },
  table => [
    // Enforces "no duplicate pending invitation for the same email" at the DB level too.
    uniqueIndex('invitations_pending_email_idx')
      .on(table.email)
      .where(sql`${table.status} = 'pending'`),
  ],
)

export const invitationsRelations = relations(invitations, ({ one }) => ({
  invitedByUser: one(users, { fields: [invitations.invitedBy], references: [users.id] }),
}))
