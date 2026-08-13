// Full recompute from `pastes` (source of truth) rather than incremental increment/decrement
// on every create/read/purge — avoids drift, cheap enough at self-hosted scale.
export async function refreshStats() {
  const bytesStoredExpr = sql<number>`coalesce(sum(coalesce(octet_length(${schema.pastes.ciphertext}), 0) + coalesce(octet_length(${schema.pastes.fileBlob}), 0)), 0)`

  const [appAgg] = await db
    .select({
      activePastesCountAnonymous: count(sql`case when ${schema.pastes.ownerId} is null then 1 end`),
      activePastesCountAuthenticated: count(sql`case when ${schema.pastes.ownerId} is not null then 1 end`),
      activeBytesStored: bytesStoredExpr
    })
    .from(schema.pastes)

  await db
    .insert(schema.appStats)
    .values({ id: 1, ...appAgg, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.appStats.id,
      set: { ...appAgg, updatedAt: new Date() }
    })

  const perUser = await db
    .select({
      userId: schema.pastes.ownerId,
      activePastesCount: count(),
      activeBytesStored: bytesStoredExpr
    })
    .from(schema.pastes)
    .where(isNotNull(schema.pastes.ownerId))
    .groupBy(schema.pastes.ownerId)

  await db.delete(schema.userStats)
  if (perUser.length > 0) {
    await db.insert(schema.userStats).values(
      perUser.map(row => ({
        userId: row.userId!,
        activePastesCount: row.activePastesCount,
        activeBytesStored: row.activeBytesStored,
        updatedAt: new Date()
      }))
    )
  }
}
