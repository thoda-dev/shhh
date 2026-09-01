export default defineEventHandler(async (event) => {
  const parsedId = pasteIdParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsedId.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid paste id' })
  }

  const [paste] = await db
    .select({
      kind: schema.pastes.kind,
      format: schema.pastes.format,
      passwordProtected: schema.pastes.passwordProtected,
      maxReads: schema.pastes.maxReads,
      readCount: schema.pastes.readCount,
      expiresAt: schema.pastes.expiresAt,
      fileMime: schema.pastes.fileMime,
      fileSize: schema.pastes.fileSize
    })
    .from(schema.pastes)
    .where(eq(schema.pastes.id, parsedId.data))
    .limit(1)

  if (!paste || !isPasteAccessible(paste)) {
    throw createError({ statusCode: 404, statusMessage: 'Paste not found' })
  }

  return {
    kind: paste.kind,
    passwordProtected: paste.passwordProtected,
    readsRemaining: paste.maxReads === null ? null : paste.maxReads - paste.readCount,
    expiresAt: paste.expiresAt,
    // Before the reveal, so the page knows whether it is about to render a document or a secret.
    ...(paste.kind === 'text' ? { format: paste.format } : { fileMime: paste.fileMime, fileSize: paste.fileSize })
  }
})
