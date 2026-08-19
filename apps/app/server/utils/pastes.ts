import { z } from 'zod'

export const pasteIdParamSchema = z.string().uuid()

export function isPasteAccessible(paste: { expiresAt: Date, maxReads: number | null, readCount: number }) {
  if (paste.expiresAt.getTime() <= Date.now()) return false
  if (paste.maxReads !== null && paste.readCount >= paste.maxReads) return false
  return true
}
