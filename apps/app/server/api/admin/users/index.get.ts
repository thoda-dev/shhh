export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      emailVerified: schema.users.emailVerified,
      twoFactorEnabled: schema.users.twoFactorEnabled,
      createdAt: schema.users.createdAt
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt))
})
