import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)

  const parsedId = z.string().uuid().safeParse(getRouterParam(event, 'id'))
  if (!parsedId.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid id' })
  }

  const [deleted] = await db.delete(schema.allowedIps).where(eq(schema.allowedIps.id, parsedId.data)).returning()

  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  await db.insert(schema.adminAuditLog).values({
    actorId: session.user.id,
    action: 'allowed_ip.delete',
    targetId: deleted.id,
    details: { ip: deleted.ip }
  })

  return { success: true }
})
