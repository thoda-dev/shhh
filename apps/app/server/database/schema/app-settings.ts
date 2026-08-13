import { relations } from 'drizzle-orm'
import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { users } from './user'

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
})

export const appSettingsRelations = relations(appSettings, ({ one }) => ({
  updatedByUser: one(users, { fields: [appSettings.updatedBy], references: [users.id] }),
}))
