export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  return db
    .select({
      id: schema.allowedIps.id,
      ip: schema.allowedIps.ip,
      label: schema.allowedIps.label,
      createdAt: schema.allowedIps.createdAt
    })
    .from(schema.allowedIps)
    .orderBy(desc(schema.allowedIps.createdAt))
})
