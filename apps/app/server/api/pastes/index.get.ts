export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  return db
    .select({
      id: schema.pastes.id,
      kind: schema.pastes.kind,
      passwordProtected: schema.pastes.passwordProtected,
      maxReads: schema.pastes.maxReads,
      readCount: schema.pastes.readCount,
      expiresAt: schema.pastes.expiresAt,
      createdAt: schema.pastes.createdAt,
      fileMime: schema.pastes.fileMime,
      fileSize: schema.pastes.fileSize
    })
    .from(schema.pastes)
    .where(eq(schema.pastes.ownerId, session.user.id))
    .orderBy(desc(schema.pastes.createdAt))
})
