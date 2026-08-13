import { z } from 'zod'

// Fallback used only when an admin has explicitly set the retention cap to "unlimited"
// (app_settings row present with value = null) and the client didn't request a specific
// duration — matches the same numbers as the app_settings defaults (project.md section 5).
const DEFAULT_RETENTION_DAYS = { anonymous: 7, authenticated: 30 } as const

// Email sharing is only ever accepted here, at creation, and only from an authenticated session —
// see the zero-knowledge note in `server/utils/paste-sharing.ts` for why the key may only cross the
// wire at this single point. `fragmentKey` is the base64url key from the URL fragment; the server
// composes the link itself since the paste id doesn't exist client-side yet.
const shareSchema = z.object({
  fragmentKey: z.string().min(1).max(256),
  recipients: z.array(z.string().email()).min(1)
})

const baseFields = {
  passwordProtected: z.boolean().default(false),
  maxReads: z.number().int().positive().nullable().optional(),
  expiresInDays: z.number().int().positive().optional(),
  turnstileToken: z.string(),
  share: shareSchema.optional()
}

const textPasteSchema = z.object({
  kind: z.literal('text'),
  ciphertext: z.string().base64(),
  iv: z.string().base64(),
  ...baseFields
})

const filePasteSchema = z.object({
  kind: z.literal('file'),
  fileBlob: z.string().base64(),
  fileIv: z.string().base64(),
  fileNameEnc: z.string().base64(),
  fileNameIv: z.string().base64(),
  fileMime: z.string().min(1).max(255),
  ...baseFields
})

const createPasteSchema = z.discriminatedUnion('kind', [textPasteSchema, filePasteSchema])

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event)
  const body = await readValidatedBody(event, createPasteSchema.parse)

  if (body.kind === 'file' && !session) {
    throw createError({ statusCode: 403, statusMessage: 'File uploads require an authenticated account' })
  }

  if (body.share) {
    if (!session) {
      throw createError({ statusCode: 403, statusMessage: 'Email sharing requires an authenticated account' })
    }
    if (!isMailEnabled()) {
      throw createError({ statusCode: 503, statusMessage: 'This instance has no mail provider configured' })
    }
  }

  const tier = session ? 'authenticated' : 'anonymous'

  const settings = await getSettings([
    'max_text_size_bytes',
    'max_upload_size_bytes',
    'max_retention_days_anonymous',
    'max_retention_days_authenticated',
    'max_reads_anonymous',
    'max_reads_authenticated',
    'rate_limit_anonymous_creates_per_period',
    'rate_limit_authenticated_creates_per_period',
    'rate_limit_uploads_per_period',
    'rate_limit_period_minutes',
    'public_paste_enabled',
    'require_2fa',
    'max_total_pastes',
    'max_total_storage_bytes',
    'max_email_recipients_per_paste'
  ])

  // The only email setting that still bites: with one Bcc'd message per paste there is no send
  // volume to throttle, but the size of that single message is still worth capping.
  if (body.share && settings.max_email_recipients_per_paste !== null
    && body.share.recipients.length > settings.max_email_recipients_per_paste) {
    throw createError({
      statusCode: 400,
      statusMessage: `A paste can be shared with at most ${settings.max_email_recipients_per_paste} recipients`
    })
  }

  // Turning `public_paste_enabled` off makes the instance accounts-only; it doesn't close it down.
  // Authenticated creation, and reading an existing paste, are both unaffected.
  if (!session && !settings.public_paste_enabled) {
    throw createError({ statusCode: 403, statusMessage: 'Anonymous pastes are disabled on this instance' })
  }

  if (session) {
    await assertTwoFactorCompliance(session.user, settings.require_2fa)
  }

  const identifier = session ? session.user.id : (getRequestIP(event, { xForwardedFor: true }) ?? 'unknown')

  const rateLimit = await checkRateLimit({
    scope: tier === 'anonymous' ? 'ip' : 'user',
    identifier,
    kind: 'create',
    limit: tier === 'anonymous' ? settings.rate_limit_anonymous_creates_per_period : settings.rate_limit_authenticated_creates_per_period,
    periodMinutes: settings.rate_limit_period_minutes
  })

  if (!rateLimit.allowed) {
    setResponseHeader(event, 'Retry-After', Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString())
    throw createError({ statusCode: 429, statusMessage: 'Too many pastes created, try again later' })
  }

  // Anti-bot frontline (project.md section 6, point 4) — required for every tier, including
  // authenticated: account sign-up alone doesn't stop a bot operating through a stolen/compromised
  // account, so Turnstile stays a separate layer regardless of session state.
  const verification = await verifyTurnstileToken(body.turnstileToken, event)
  if (!verification.success) {
    throw createError({ statusCode: 403, statusMessage: 'Turnstile verification failed' })
  }

  // Separate, stricter layer on top of the general create cap above — uploads only, always
  // scoped by user (anonymous file uploads are already rejected earlier). project.md section 6.
  if (body.kind === 'file') {
    const uploadRateLimit = await checkRateLimit({
      scope: 'user',
      identifier,
      kind: 'upload',
      limit: settings.rate_limit_uploads_per_period,
      periodMinutes: settings.rate_limit_period_minutes
    })

    if (!uploadRateLimit.allowed) {
      setResponseHeader(event, 'Retry-After', Math.ceil((uploadRateLimit.resetAt - Date.now()) / 1000).toString())
      throw createError({ statusCode: 429, statusMessage: 'Too many file uploads created, try again later' })
    }
  }

  const maxRetentionDays = tier === 'anonymous' ? settings.max_retention_days_anonymous : settings.max_retention_days_authenticated
  const maxReadsCap = tier === 'anonymous' ? settings.max_reads_anonymous : settings.max_reads_authenticated

  const expiresInDays = body.expiresInDays ?? maxRetentionDays ?? DEFAULT_RETENTION_DAYS[tier]
  if (maxRetentionDays !== null && expiresInDays > maxRetentionDays) {
    throw createError({ statusCode: 400, statusMessage: `expiresInDays exceeds the instance limit of ${maxRetentionDays} days` })
  }

  let maxReads: number | null
  if (body.maxReads === undefined) {
    maxReads = maxReadsCap
  } else if (maxReadsCap !== null && (body.maxReads === null || body.maxReads > maxReadsCap)) {
    throw createError({ statusCode: 400, statusMessage: `maxReads exceeds the instance limit of ${maxReadsCap}` })
  } else {
    maxReads = body.maxReads
  }

  const values: typeof schema.pastes.$inferInsert = {
    ownerId: session?.user.id ?? null,
    kind: body.kind,
    passwordProtected: body.passwordProtected,
    maxReads,
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
  }

  if (body.kind === 'text') {
    const ciphertext = Buffer.from(body.ciphertext, 'base64')
    if (settings.max_text_size_bytes !== null && ciphertext.length > settings.max_text_size_bytes) {
      throw createError({ statusCode: 413, statusMessage: `Paste exceeds the instance size limit of ${settings.max_text_size_bytes} bytes` })
    }
    values.ciphertext = ciphertext
    values.iv = Buffer.from(body.iv, 'base64')
  } else {
    const fileBlob = Buffer.from(body.fileBlob, 'base64')
    if (settings.max_upload_size_bytes !== null && fileBlob.length > settings.max_upload_size_bytes) {
      throw createError({ statusCode: 413, statusMessage: `File exceeds the instance size limit of ${settings.max_upload_size_bytes} bytes` })
    }
    values.fileBlob = fileBlob
    values.fileIv = Buffer.from(body.fileIv, 'base64')
    values.fileNameEnc = Buffer.from(body.fileNameEnc, 'base64')
    values.fileNameIv = Buffer.from(body.fileNameIv, 'base64')
    values.fileMime = body.fileMime
    // Computed from the actual decoded blob, never trusted from the client.
    values.fileSize = fileBlob.length
  }

  // Instance-wide quotas (project.md section 5). Read live from `pastes` rather than the
  // denormalised `app_stats`, which the purge task only refreshes hourly — an hour of drift on a
  // disk-exhaustion guard would defeat its purpose. Not atomic against concurrent creates (same
  // deliberate tradeoff as the rate limiter): a guard rail, not an accountant. Skipped entirely
  // when both quotas are unlimited, so the default instance never pays for the scan.
  if (settings.max_total_pastes !== null || settings.max_total_storage_bytes !== null) {
    const [totals] = await db
      .select({
        pasteCount: count(),
        storedBytes: sql<string>`coalesce(sum(coalesce(octet_length(${schema.pastes.ciphertext}), 0) + coalesce(octet_length(${schema.pastes.fileBlob}), 0)), 0)`
      })
      .from(schema.pastes)

    const incomingBytes = (values.ciphertext?.length ?? 0) + (values.fileBlob?.length ?? 0)

    if (settings.max_total_pastes !== null && Number(totals?.pasteCount ?? 0) + 1 > settings.max_total_pastes) {
      throw createError({ statusCode: 503, statusMessage: 'This instance has reached its paste limit' })
    }

    if (settings.max_total_storage_bytes !== null && Number(totals?.storedBytes ?? 0) + incomingBytes > settings.max_total_storage_bytes) {
      throw createError({ statusCode: 507, statusMessage: 'This instance has reached its storage quota' })
    }
  }

  const [paste] = await db.insert(schema.pastes).values(values).returning({
    id: schema.pastes.id,
    kind: schema.pastes.kind,
    expiresAt: schema.pastes.expiresAt,
    maxReads: schema.pastes.maxReads,
    passwordProtected: schema.pastes.passwordProtected
  })

  // After the insert: the link can only be composed once the paste id exists. A delivery failure is
  // reported back (`shared: false`) rather than thrown — the paste is already created and perfectly
  // usable, so the caller still needs its id and link.
  let shared: boolean | undefined
  if (body.share && session) {
    const result = await sharePasteByEmail({
      pasteId: paste!.id,
      fragmentKey: body.share.fragmentKey,
      recipients: body.share.recipients,
      senderName: session.user.name || session.user.email,
      senderEmail: session.user.email,
      remainingReads: paste!.maxReads,
      expiresAt: paste!.expiresAt
    })
    shared = result.sent
  }

  setResponseStatus(event, 201)
  return { ...paste, ...(shared === undefined ? {} : { shared }) }
})
