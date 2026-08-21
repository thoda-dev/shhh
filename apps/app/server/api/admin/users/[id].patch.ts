import { z } from 'zod'

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin', 'super_admin'])
})

export default defineEventHandler(async (event) => {
  const session = await requireSuperAdminSession(event)

  const targetId = getRouterParam(event, 'id')
  if (!targetId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user id' })
  }
  // Nobody changes their own role, super_admin included.
  if (targetId === session.user.id) {
    throw createError({ statusCode: 403, statusMessage: 'You can\'t change your own role' })
  }

  const body = await readValidatedBody(event, updateRoleSchema.parse)

  const [updated] = await db
    .update(schema.users)
    .set({ role: body.role })
    .where(eq(schema.users.id, targetId))
    .returning({ id: schema.users.id, email: schema.users.email, role: schema.users.role })

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  await db.insert(schema.adminAuditLog).values({
    actorId: session.user.id,
    action: 'user.role_update',
    targetId: updated.id,
    details: { email: updated.email, role: body.role }
  })

  return updated
})
