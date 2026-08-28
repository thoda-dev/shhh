// Runs the hourly purge on demand. Same predicate, so it reclaims exactly what the report announces.
export default defineEventHandler(async (event) => {
  const session = await requireSuperAdminSession(event)

  // No RETURNING: the driver reports the affected row count, and a large purge would otherwise
  // materialise one id per deleted paste for nothing.
  const { count } = await db
    .delete(schema.pastes)
    .where(isPasteReclaimable())

  await refreshStats()

  await db.insert(schema.adminAuditLog).values({
    actorId: session.user.id,
    action: 'pastes.purge',
    details: { deletedCount: count }
  })

  return { deletedCount: count }
})
