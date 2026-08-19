export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)

  const targetId = getRouterParam(event, 'id')
  if (!targetId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user id' })
  }
  // project.md section 7: nobody can delete themselves, no exceptions — a simple id check, not a
  // remaining-super_admin count (explicitly decided against that complexity).
  if (targetId === session.user.id) {
    throw createError({ statusCode: 403, statusMessage: 'You can\'t delete your own account here' })
  }

  const [target] = await db.select({ id: schema.users.id, role: schema.users.role, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, targetId)).limit(1)
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  // An admin can only act on plain users — never another admin or a super_admin. Only a
  // super_admin can delete/demote admins or other super_admins (team rotation, allowed by design).
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
