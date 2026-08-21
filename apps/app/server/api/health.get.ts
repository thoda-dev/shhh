// Public and unauthenticated: no counts beyond storage usage, and a failing dependency is reported as a status, never a stack trace.
export default defineEventHandler(async (event) => {
  let dbOk = true
  let usedBytes = 0

  try {
    const [row] = await db
      .select({
        usedBytes: sql<string>`coalesce(sum(coalesce(octet_length(${schema.pastes.ciphertext}), 0) + coalesce(octet_length(${schema.pastes.fileBlob}), 0)), 0)`
      })
      .from(schema.pastes)
    usedBytes = Number(row?.usedBytes ?? 0)
  } catch (error) {
    dbOk = false
    console.error('[health] database check failed:', error instanceof Error ? error.message : error)
  }

  // Falls back to the hardcoded default when unset, but only if the database answered — otherwise the quota would read as a configured value.
  const quotaBytes = dbOk ? await getSetting('max_total_storage_bytes').catch(() => null) : null

  if (!dbOk) {
    setResponseStatus(event, 503)
  }

  return {
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk ? 'ok' : 'down',
    mail: getMailProvider(),
    storage: { usedBytes, quotaBytes }
  }
})
