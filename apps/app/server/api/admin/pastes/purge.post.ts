// Runs the hourly purge on demand. Same predicate, so it reclaims exactly what the report announces.
export default defineEventHandler(async (event) => {
  const session = await requireSuperAdminSession(event)

  const deleted = await db
    .delete(schema.pastes)
    .where(isPasteReclaimable())
    .returning({ id: schema.pastes.id })

  await refreshStats()

  await db.insert(schema.adminAuditLog).values({
    actorId: session.user.id,
    action: 'pastes.purge',
    details: { deletedCount: deleted.length }
  })

  return { deletedCount: deleted.length }
})
