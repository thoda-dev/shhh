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

export default defineEventHandler(async (event) => {
  if (await isSetupComplete()) {
    throw createError({ statusCode: 409, statusMessage: 'Setup already completed' })
  }

  const body = await readValidatedBody(event, setupSchema.parse)

  const { headers, response } = await auth.api.signUpEmail({
    body: { name: body.name, email: body.email, password: body.password },
    headers: event.headers,
    returnHeaders: true
  })

  // Not a signup input (`input: false` in auth.ts), so it is set directly. Auto-verified: completing the wizard proves control of both the instance and this address.
  await db.update(schema.users).set({ role: 'super_admin', emailVerified: true }).where(eq(schema.users.id, response.user.id))

  await db.insert(schema.appSettings).values(
    Object.entries(body.settings).map(([key, value]) => ({ key, value, updatedBy: response.user.id }))
  )

  for (const cookie of headers.getSetCookie()) {
    appendResponseHeader(event, 'set-cookie', cookie)
  }

  setResponseStatus(event, 201)
  return { id: response.user.id, name: response.user.name, email: response.user.email }
})
