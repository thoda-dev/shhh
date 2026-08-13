export default defineEventHandler(async (event) => {
  const parsedId = pasteIdParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsedId.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid paste id' })
  }

  // Atomic: the WHERE clause re-checks expiry/exhaustion at update time, so concurrent
  // requests on a near-exhausted single-read paste can't both succeed (project.md section 3).
  const [paste] = await db
    .update(schema.pastes)
    .set({ readCount: sql`${schema.pastes.readCount} + 1`, lastReadAt: new Date() })
    .where(
      and(
        eq(schema.pastes.id, parsedId.data),
        gt(schema.pastes.expiresAt, new Date()),
        or(isNull(schema.pastes.maxReads), lt(schema.pastes.readCount, schema.pastes.maxReads))
      )
    )
    .returning()

  if (!paste) {
    throw createError({ statusCode: 404, statusMessage: 'Paste not found' })
  }

  if (paste.kind === 'text') {
    return {
      kind: 'text' as const,
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
