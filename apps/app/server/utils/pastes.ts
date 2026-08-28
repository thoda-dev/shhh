import { z } from 'zod'

export const pasteIdParamSchema = z.string().uuid()

export function isPasteAccessible(paste: { expiresAt: Date, maxReads: number | null, readCount: number }) {
  if (paste.expiresAt.getTime() <= Date.now()) return false
  if (paste.maxReads !== null && paste.readCount >= paste.maxReads) return false
  return true
}

// The SQL counterpart of `isPasteAccessible`, negated: what the hourly purge deletes, and what the
// admin tools count and delete on demand. One definition, so the three can never disagree.
export function isPasteReclaimable() {
  return or(
    lte(schema.pastes.expiresAt, new Date()),
    and(isNotNull(schema.pastes.maxReads), gte(schema.pastes.readCount, schema.pastes.maxReads))
  )
}
