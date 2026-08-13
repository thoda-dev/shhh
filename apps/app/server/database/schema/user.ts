import { relations } from 'drizzle-orm'
import { pgTable, pgEnum, text, boolean, timestamp } from 'drizzle-orm/pg-core'
import { sessions } from './session'
import { accounts } from './account'
import { twoFactors } from './two-factor'
import { pastes } from './paste'

export const roleEnum = pgEnum('role', ['user', 'admin', 'super_admin'])

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
  role: roleEnum('role').notNull().default('user'),
})

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  twoFactors: many(twoFactors),
  pastes: many(pastes),
}))
