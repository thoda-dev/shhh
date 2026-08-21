export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)

  const targetId = getRouterParam(event, 'id')
  if (!targetId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user id' })
  }
  // Nobody deletes themselves. A plain id check, not a remaining-super_admin count.
  if (targetId === session.user.id) {
    throw createError({ statusCode: 403, statusMessage: 'You can\'t delete your own account here' })
  }

  const [target] = await db.select({ id: schema.users.id, role: schema.users.role, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, targetId)).limit(1)
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  // An admin only acts on plain users. Deleting or demoting an admin takes a super_admin, which is how team rotation works.
  if (session.user.role === 'admin' && target.role !== 'user') {
    throw createError({ statusCode: 403, statusMessage: 'Admins can only remove user accounts' })
  }

  await db.delete(schema.users).where(eq(schema.users.id, targetId))

  await db.insert(schema.adminAuditLog).values({
    actorId: session.user.id,
    action: 'user.delete',
    targetId: target.id,
    details: { email: target.email, role: target.role }
  })

  return { success: true }
})
