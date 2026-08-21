import { z } from 'zod'

const settingsSchema = z.object({
  max_retention_days_anonymous: z.number().int().positive().nullable(),
  max_retention_days_authenticated: z.number().int().positive().nullable(),
  max_text_size_bytes: z.number().int().positive().nullable(),
  max_upload_size_bytes: z.number().int().positive().nullable(),
  max_total_storage_bytes: z.number().int().positive().nullable(),
  rate_limit_anonymous_creates_per_period: z.number().int().positive().nullable(),
  rate_limit_authenticated_creates_per_period: z.number().int().positive().nullable(),
  rate_limit_uploads_per_period: z.number().int().positive().nullable(),
  rate_limit_period_minutes: z.number().int().positive()
})

const setupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  settings: settingsSchema
})

// Distinct from the migrator's key: this one serialises the wizard, not the schema.
const SETUP_LOCK_KEY = 4_827_302

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, setupSchema.parse)

  // The check and the write have to be one critical section. Without it two requests arriving
  // together both see an empty instance and both create a super_admin — the account that owns
  // everything, so "unlikely" is not a good enough guarantee.
  await db.execute(sql`select pg_advisory_lock(${SETUP_LOCK_KEY})`)
  try {
    return await completeSetup(event, body)
  } finally {
    await db.execute(sql`select pg_advisory_unlock(${SETUP_LOCK_KEY})`)
  }
})

async function completeSetup(event: Parameters<typeof appendResponseHeader>[0], body: z.infer<typeof setupSchema>) {
  if (await isSetupComplete()) {
    throw createError({ statusCode: 409, statusMessage: 'Setup already completed' })
  }

  const { headers, response } = await auth.api.signUpEmail({
    body: { name: body.name, email: body.email, password: body.password },
    headers: event.headers,
    returnHeaders: true
  })

  // Not a signup input (`input: false` in auth.ts), so it is set directly. Auto-verified: completing the wizard proves control of both the instance and this address.
  await db.update(schema.users).set({ role: 'super_admin', emailVerified: true }).where(eq(schema.users.id, response.user.id))

  // A retry after a partially failed setup would otherwise hit the primary key and surface as a
  // 500 rather than finishing the job.
  await db
    .insert(schema.appSettings)
    .values(Object.entries(body.settings).map(([key, value]) => ({ key, value, updatedBy: response.user.id })))
    .onConflictDoNothing({ target: schema.appSettings.key })

  for (const cookie of headers.getSetCookie()) {
    appendResponseHeader(event, 'set-cookie', cookie)
  }

  setResponseStatus(event, 201)
  return { id: response.user.id, name: response.user.name, email: response.user.email }
}
