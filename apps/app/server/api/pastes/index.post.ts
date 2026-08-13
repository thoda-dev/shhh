import { z } from 'zod'

// Fallback used only when an admin has explicitly set the retention cap to "unlimited"
// (app_settings row present with value = null) and the client didn't request a specific
// duration — matches the same numbers as the app_settings defaults (project.md section 5).
const DEFAULT_RETENTION_DAYS = { anonymous: 7, authenticated: 30 } as const

const baseFields = {
  passwordProtected: z.boolean().default(false),
  maxReads: z.number().int().positive().nullable().optional(),
  expiresInDays: z.number().int().positive().optional(),
  turnstileToken: z.string()
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
    'rate_limit_period_minutes'
  ])

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

  const [paste] = await db.insert(schema.pastes).values(values).returning({
    id: schema.pastes.id,
    kind: schema.pastes.kind,
    expiresAt: schema.pastes.expiresAt,
    maxReads: schema.pastes.maxReads,
    passwordProtected: schema.pastes.passwordProtected
  })

  setResponseStatus(event, 201)
  return paste
})
