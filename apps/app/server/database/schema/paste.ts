import { relations, sql } from 'drizzle-orm'
import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  index,
  check,
  customType
} from 'drizzle-orm/pg-core'
import { users } from './user'
import { pasteEmailRecipients } from './paste-email-recipient'

// Encrypted payloads are opaque to the server (zero-knowledge) — stored as raw bytes, never text/base64.
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea'
  }
})

export const pasteKindEnum = pgEnum('paste_kind', ['text', 'file'])

export const pastes = pgTable(
  'pastes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerId: text('owner_id').references(() => users.id, { onDelete: 'cascade' }),
    kind: pasteKindEnum('kind').notNull(),

    // kind = 'text'
    ciphertext: bytea('ciphertext'),
    iv: bytea('iv'),

    // kind = 'file'
    fileBlob: bytea('file_blob'),
    fileIv: bytea('file_iv'),
    fileNameEnc: bytea('file_name_enc'),
    fileNameIv: bytea('file_name_iv'),
    fileMime: text('file_mime'),
    fileSize: integer('file_size'),

    passwordProtected: boolean('password_protected').notNull().default(false),
    maxReads: integer('max_reads'),
    readCount: integer('read_count').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastReadAt: timestamp('last_read_at', { withTimezone: true })
  },
  table => [
    index('pastes_owner_id_idx').on(table.ownerId),
    index('pastes_expires_at_idx').on(table.expiresAt),
    check(
      'pastes_kind_payload_check',
      sql`(${table.kind} = 'text' AND ${table.ciphertext} IS NOT NULL AND ${table.fileBlob} IS NULL)
        OR (${table.kind} = 'file' AND ${table.fileBlob} IS NOT NULL AND ${table.ciphertext} IS NULL)`
    )
  ]
)

export const pastesRelations = relations(pastes, ({ one, many }) => ({
  owner: one(users, { fields: [pastes.ownerId], references: [users.id] }),
  emailRecipients: many(pasteEmailRecipients)
}))
