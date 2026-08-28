import { z } from 'zod'

const querySchema = z.object({ scope: z.enum(['reclaimable', 'all']) })

// Deleting someone's pastes is blind by design: the server cannot read them, so this acts on a
// count, never on content. Super admin only — an admin removing a whole account already cascades.
export default defineEventHandler(async (event) => {
  const session = await requireSuperAdminSession(event)

  const targetId = getRouterParam(event, 'id')
  if (!targetId) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid user id' })
  }

  const { scope } = await getValidatedQuery(event, querySchema.parse)

  const [target] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, targetId))
    .limit(1)
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const owned = eq(schema.pastes.ownerId, targetId)
  const deleted = await db
    .delete(schema.pastes)
    .where(scope === 'all' ? owned : and(owned, isPasteReclaimable()))
    .returning({ id: schema.pastes.id })

  await refreshStats()

  await db.insert(schema.adminAuditLog).values({
    actorId: session.user.id,
    action: 'pastes.delete',
    targetId: target.id,
    details: { email: target.email, scope, deletedCount: deleted.length }
  })

  return { deletedCount: deleted.length }
})
