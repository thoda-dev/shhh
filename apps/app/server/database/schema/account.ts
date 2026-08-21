import { relations } from 'drizzle-orm'
import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './user'

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    // Better Auth 1.7 scopes an account's identity to (issuer, accountId) rather than to providerId
    // alone. This instance configures no social provider, so every row is a credential account and
    // carries the value Better Auth reserves for them.
    issuer: text('issuer').notNull(),
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
  table => [
    index('accounts_user_id_idx').on(table.userId),
    // Required by Better Auth: the pair is what identifies an external account.
    uniqueIndex('accounts_issuer_account_id_idx').on(table.issuer, table.accountId)
  ]
)

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] })
}))
