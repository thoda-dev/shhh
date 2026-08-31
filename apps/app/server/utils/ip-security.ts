// Bans posted by the middleware expire on their own. A scanner simply comes back and is banned
// again; a real person caught by the heuristic — a shared office address, a curious employee
// poking at /wp-admin — gets back in without the operator having to notice and intervene.
// Set AUTO_BAN_DURATION_HOURS=0 to keep the old behaviour and ban permanently.
const DEFAULT_AUTO_BAN_HOURS = 72

/** `null` means a ban never expires. */
export function autoBanDurationHours(): number | null {
  const raw = process.env.AUTO_BAN_DURATION_HOURS
  const hours = raw === undefined || raw.trim() === '' ? DEFAULT_AUTO_BAN_HOURS : Number(raw)
  if (!Number.isInteger(hours) || hours < 0) return DEFAULT_AUTO_BAN_HOURS
  return hours === 0 ? null : hours
}

function autoBanExpiry(): Date | null {
  const hours = autoBanDurationHours()
  return hours === null ? null : new Date(Date.now() + hours * 3_600_000)
}

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
  // An update rather than `onConflictDoNothing`: a lapsed row still occupies the unique index, so
  // doing nothing would leave a repeat offender permanently unbannable after their first ban expired.
  //
  // `setWhere` on a non-null expires_at is what keeps that from working in reverse: a permanent ban
  // is one an admin placed by hand, and the middleware must never quietly shorten it to 72 hours.
  await db
    .insert(schema.bannedIps)
    .values({ ip, reason, expiresAt: autoBanExpiry() })
    .onConflictDoUpdate({
      target: schema.bannedIps.ip,
      set: { reason, bannedAt: new Date(), expiresAt: autoBanExpiry() },
      setWhere: isNotNull(schema.bannedIps.expiresAt)
    })
}
