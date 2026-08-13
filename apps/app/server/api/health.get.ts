// Shape fixed by project.md section 12, meant to be pointed at Uptime Kuma directly.
// Public and unauthenticated, so it deliberately exposes no counts beyond storage usage and no
// error details — a failing dependency is reported as a status, never as a stack trace.
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

  // Read from app_settings, so it falls back to the hardcoded default when unset — but only if the
  // database answered at all; otherwise the quota would be reported as a real configured value.
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
