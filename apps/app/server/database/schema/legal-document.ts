import { relations } from 'drizzle-orm'
import { pgTable, pgEnum, text, timestamp, primaryKey } from 'drizzle-orm/pg-core'
import { users } from './user'

export const legalDocumentSlugEnum = pgEnum('legal_document_slug', ['privacy', 'terms', 'notice'])

// One row per document and locale. No row means no page and no footer link.
export const legalDocuments = pgTable(
  'legal_documents',
  {
    slug: legalDocumentSlugEnum('slug').notNull(),
    locale: text('locale').notNull(),
    content: text('content').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' })
  },
  table => [primaryKey({ columns: [table.slug, table.locale] })]
)

export const legalDocumentsRelations = relations(legalDocuments, ({ one }) => ({
  updatedByUser: one(users, { fields: [legalDocuments.updatedBy], references: [users.id] })
}))
