export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  // Counts are joined in rather than read from `user_stats`: the hourly counters would make a
  // confirmation dialog promise a number the deletion then contradicts.
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      emailVerified: schema.users.emailVerified,
      twoFactorEnabled: schema.users.twoFactorEnabled,
      createdAt: schema.users.createdAt,
      pastesCount: sql<string>`count(${schema.pastes.id})`,
      reclaimablePastesCount: sql<string>`count(${schema.pastes.id}) filter (where ${isPasteReclaimable()})`
    })
    .from(schema.users)
    .leftJoin(schema.pastes, eq(schema.pastes.ownerId, schema.users.id))
    .groupBy(schema.users.id)
    .orderBy(desc(schema.users.createdAt))

  return rows.map(row => ({
    ...row,
    pastesCount: Number(row.pastesCount),
    reclaimablePastesCount: Number(row.reclaimablePastesCount)
  }))
})
