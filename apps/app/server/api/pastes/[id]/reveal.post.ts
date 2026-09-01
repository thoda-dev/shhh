import { z } from 'zod'

const revealSchema = z.object({
  // sha256 of the AES key the reader derived. Proves possession of the link and, when the paste is
  // password protected, of the password — see `deriveUnlockHash` in app/utils/crypto.ts.
  unlockHash: z.string().base64().optional()
})

export default defineEventHandler(async (event) => {
  const parsedId = pasteIdParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsedId.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid paste id' })
  }

  const body = await readValidatedBody(event, revealSchema.parse)
  const unlockHash = body.unlockHash ? Buffer.from(body.unlockHash, 'base64') : null

  // Atomic, and the proof is part of the match rather than a check before it: a reader without the
  // key — or with the wrong password — updates no row, so the read counter never moves. Knowing a
  // paste id is not enough to destroy it, and a mistyped password costs nothing.
  //
  // `isNull` covers pastes created before unlock hashes existed; they keep the old behaviour until
  // they expire, which the retention cap bounds.
  const [paste] = await db
    .update(schema.pastes)
    .set({ readCount: sql`${schema.pastes.readCount} + 1`, lastReadAt: new Date() })
    .where(
      and(
        eq(schema.pastes.id, parsedId.data),
        gt(schema.pastes.expiresAt, new Date()),
        or(isNull(schema.pastes.maxReads), lt(schema.pastes.readCount, schema.pastes.maxReads)),
        or(isNull(schema.pastes.unlockHash), eq(schema.pastes.unlockHash, unlockHash!))
      )
    )
    .returning()

  if (!paste) {
    // Deliberately the same 404 whether the paste is gone, exhausted, or the proof was wrong: an
    // unauthenticated caller must not be able to tell an existing paste from a missing one.
    throw createError({ statusCode: 404, statusMessage: 'Paste not found' })
  }

  if (paste.kind === 'text') {
    return {
      kind: 'text' as const,
      format: paste.format,
      passwordProtected: paste.passwordProtected,
      ciphertext: paste.ciphertext!.toString('base64'),
      iv: paste.iv!.toString('base64')
    }
  }

  return {
    kind: 'file' as const,
    passwordProtected: paste.passwordProtected,
    fileBlob: paste.fileBlob!.toString('base64'),
    fileIv: paste.fileIv!.toString('base64'),
    fileNameEnc: paste.fileNameEnc!.toString('base64'),
    fileNameIv: paste.fileNameIv!.toString('base64'),
    fileMime: paste.fileMime,
    fileSize: paste.fileSize
  }
})
