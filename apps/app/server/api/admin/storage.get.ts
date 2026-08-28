// Read live from `pastes` rather than the hourly `app_stats`: this page exists to answer
// "how close am I to the quota", and the quota guard in the create path reads live too.
export default defineEventHandler(async (event) => {
  await requireSuperAdminSession(event)

  const bytes = sql`coalesce(octet_length(${schema.pastes.ciphertext}), 0) + coalesce(octet_length(${schema.pastes.fileBlob}), 0)`

  // Same predicate as the hourly purge task, so "reclaimable" means exactly what that task will delete.
  const reclaimable = sql`${schema.pastes.expiresAt} <= now() or (${schema.pastes.maxReads} is not null and ${schema.pastes.readCount} >= ${schema.pastes.maxReads})`

  const isText = sql`${schema.pastes.kind} = 'text'`
  const isFile = sql`${schema.pastes.kind} = 'file'`
  const isAnonymous = sql`${schema.pastes.ownerId} is null`
  const isAuthenticated = sql`${schema.pastes.ownerId} is not null`

  const [totals] = await db
    .select({
      pastesTotal: sql<string>`count(*)`,
      pastesAnonymous: sql<string>`count(*) filter (where ${isAnonymous})`,
      pastesAuthenticated: sql<string>`count(*) filter (where ${isAuthenticated})`,
      pastesText: sql<string>`count(*) filter (where ${isText})`,
      pastesFile: sql<string>`count(*) filter (where ${isFile})`,
      pastesReclaimable: sql<string>`count(*) filter (where ${reclaimable})`,
      bytesTotal: sql<string>`coalesce(sum(${bytes}), 0)`,
      bytesAnonymous: sql<string>`coalesce(sum(${bytes}) filter (where ${isAnonymous}), 0)`,
      bytesAuthenticated: sql<string>`coalesce(sum(${bytes}) filter (where ${isAuthenticated}), 0)`,
      bytesText: sql<string>`coalesce(sum(${bytes}) filter (where ${isText}), 0)`,
      bytesFile: sql<string>`coalesce(sum(${bytes}) filter (where ${isFile}), 0)`,
      bytesReclaimable: sql<string>`coalesce(sum(${bytes}) filter (where ${reclaimable}), 0)`,
      largestText: sql<string>`coalesce(max(${bytes}) filter (where ${isText}), 0)`,
      largestFile: sql<string>`coalesce(max(${bytes}) filter (where ${isFile}), 0)`
    })
    .from(schema.pastes)

  const ownerBytes = sql<string>`coalesce(sum(${bytes}), 0)`
  const topOwners = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      pastes: sql<string>`count(*)`,
      bytes: ownerBytes
    })
    .from(schema.pastes)
    .innerJoin(schema.users, eq(schema.pastes.ownerId, schema.users.id))
    .groupBy(schema.users.id)
    .orderBy(desc(ownerBytes))
    .limit(10)

  const quotas = await getSettings([
    'max_total_pastes',
    'max_total_storage_bytes',
    'max_text_size_bytes',
    'max_upload_size_bytes'
  ])

  // What the payloads actually occupy on disk, TOAST and indexes included — always larger than the
  // sum of the ciphertexts, and the number the volume runs out of. Denied on some managed
  // PostgreSQL, hence nullable rather than fatal.
  let database: { totalBytes: number, pastesTableBytes: number } | null = null
  try {
    const rows = await db.execute<{ total_bytes: string, pastes_table_bytes: string }>(
      sql`select pg_database_size(current_database()) as total_bytes, pg_total_relation_size('pastes'::regclass) as pastes_table_bytes`
    )
    const row = rows[0]
    if (row) {
      database = { totalBytes: Number(row.total_bytes), pastesTableBytes: Number(row.pastes_table_bytes) }
    }
  } catch (error) {
    console.error('[admin/storage] database size lookup failed:', error instanceof Error ? error.message : error)
  }

  return {
    generatedAt: new Date().toISOString(),
    quotas,
    pastes: {
      total: Number(totals?.pastesTotal ?? 0),
      anonymous: Number(totals?.pastesAnonymous ?? 0),
      authenticated: Number(totals?.pastesAuthenticated ?? 0),
      text: Number(totals?.pastesText ?? 0),
      file: Number(totals?.pastesFile ?? 0),
      reclaimable: Number(totals?.pastesReclaimable ?? 0)
    },
    bytes: {
      total: Number(totals?.bytesTotal ?? 0),
      anonymous: Number(totals?.bytesAnonymous ?? 0),
      authenticated: Number(totals?.bytesAuthenticated ?? 0),
      text: Number(totals?.bytesText ?? 0),
      file: Number(totals?.bytesFile ?? 0),
      reclaimable: Number(totals?.bytesReclaimable ?? 0)
    },
    largest: {
      text: Number(totals?.largestText ?? 0),
      file: Number(totals?.largestFile ?? 0)
    },
    topOwners: topOwners.map(owner => ({
      id: owner.id,
      name: owner.name,
      email: owner.email,
      pastes: Number(owner.pastes),
      bytes: Number(owner.bytes)
    })),
    database
  }
})
