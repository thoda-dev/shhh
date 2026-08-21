// Public and unauthenticated: whether the instance answers and whether its database does, which is
// everything a monitor needs to decide up or down. A failing dependency is reported as a status,
// never as a stack trace.
//
// Storage usage and the mail provider describe the instance to whoever asks, so they are behind
// HEALTH_TOKEN. With no token configured the fields are absent rather than empty — a monitor that
// never asked for them sees no difference.
function isAuthorised(event: Parameters<typeof getRequestHeader>[0]) {
  const expected = process.env.HEALTH_TOKEN
  if (!expected) return false
  const header = getRequestHeader(event, 'authorization')
  return header === `Bearer ${expected}`
}

export default defineEventHandler(async (event) => {
  let dbOk = true

  try {
    await db.execute(sql`select 1`)
  } catch (error) {
    dbOk = false
    console.error('[health] database check failed:', error instanceof Error ? error.message : error)
  }

  if (!dbOk) {
    setResponseStatus(event, 503)
  }

  const base = { status: dbOk ? 'ok' : 'degraded', db: dbOk ? 'ok' : 'down' }
  if (!isAuthorised(event)) return base

  let usedBytes = 0
  if (dbOk) {
    const [row] = await db
      .select({
        usedBytes: sql<string>`coalesce(sum(coalesce(octet_length(${schema.pastes.ciphertext}), 0) + coalesce(octet_length(${schema.pastes.fileBlob}), 0)), 0)`
      })
      .from(schema.pastes)
    usedBytes = Number(row?.usedBytes ?? 0)
  }

  // Falls back to the hardcoded default when unset, but only if the database answered — otherwise
  // the quota would read as a configured value.
  const quotaBytes = dbOk ? await getSetting('max_total_storage_bytes').catch(() => null) : null

  return { ...base, mail: getMailProvider(), storage: { usedBytes, quotaBytes } }
})
