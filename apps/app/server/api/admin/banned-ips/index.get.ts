export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  return db
    .select({
      id: schema.bannedIps.id,
      ip: schema.bannedIps.ip,
      reason: schema.bannedIps.reason,
      bannedAt: schema.bannedIps.bannedAt,
      expiresAt: schema.bannedIps.expiresAt
    })
    .from(schema.bannedIps)
    .orderBy(desc(schema.bannedIps.bannedAt))
})
