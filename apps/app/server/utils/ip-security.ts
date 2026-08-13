export async function isIpAllowlisted(ip: string) {
  const [row] = await db.select({ id: schema.allowedIps.id }).from(schema.allowedIps).where(eq(schema.allowedIps.ip, ip)).limit(1)
  return !!row
}

export async function isIpBanned(ip: string) {
  const [row] = await db
    .select({ id: schema.bannedIps.id })
    .from(schema.bannedIps)
    .where(and(eq(schema.bannedIps.ip, ip), or(isNull(schema.bannedIps.expiresAt), gt(schema.bannedIps.expiresAt, new Date()))))
    .limit(1)
  return !!row
}

export async function banIp(ip: string, reason: string) {
  await db.insert(schema.bannedIps).values({ ip, reason }).onConflictDoNothing({ target: schema.bannedIps.ip })
}
