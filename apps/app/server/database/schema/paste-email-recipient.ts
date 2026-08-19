import { relations } from 'drizzle-orm'
import { pgTable, pgEnum, text, timestamp, uuid, index } from 'drizzle-orm/pg-core'
import { pastes } from './paste'

export const emailRecipientStatusEnum = pgEnum('email_recipient_status', ['sent', 'failed'])

export const pasteEmailRecipients = pgTable(
  'paste_email_recipients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pasteId: uuid('paste_id')
      .notNull()
      .references(() => pastes.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    status: emailRecipientStatusEnum('status').notNull().default('sent'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => [index('paste_email_recipients_paste_id_idx').on(table.pasteId)]
)

export const pasteEmailRecipientsRelations = relations(pasteEmailRecipients, ({ one }) => ({
  paste: one(pastes, { fields: [pasteEmailRecipients.pasteId], references: [pastes.id] })
}))
