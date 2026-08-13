export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const parsedId = pasteIdParamSchema.safeParse(getRouterParam(event, 'id'))
  if (!parsedId.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid paste id' })
  }

  const [deleted] = await db
    .delete(schema.pastes)
    .where(and(eq(schema.pastes.id, parsedId.data), eq(schema.pastes.ownerId, session.user.id)))
    .returning({ id: schema.pastes.id })

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Paste not found' })
  }

  setResponseStatus(event, 204)
})
