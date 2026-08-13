export async function isSetupComplete() {
  const [row] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, 'super_admin')).limit(1)
  return !!row
}
