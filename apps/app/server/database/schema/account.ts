import { relations } from 'drizzle-orm'
import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './user'

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    // Added for Better Auth 1.7.0–1.7.2, which identified an account by (issuer, accountId); 1.7.3 went back to (providerId, accountId) and never writes it.
    // Kept nullable rather than dropped so a database migrated past 0006 still works under v1.2.0 if an operator rolls back.
    issuer: text('issuer'),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .$onUpdate(() => new Date())
  },
  table => [index('accounts_user_id_idx').on(table.userId)]
)

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] })
}))
