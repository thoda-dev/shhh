import { z } from 'zod'

const settingsSchema = z.object({
  max_retention_days_anonymous: z.number().int().positive().nullable(),
  max_retention_days_authenticated: z.number().int().positive().nullable(),
  max_reads_anonymous: z.number().int().positive().nullable(),
  max_reads_authenticated: z.number().int().positive().nullable(),
  max_text_size_bytes: z.number().int().positive().nullable(),
  max_upload_size_bytes: z.number().int().positive().nullable(),
  max_total_pastes: z.number().int().positive().nullable(),
  max_total_storage_bytes: z.number().int().positive().nullable(),
  rate_limit_anonymous_creates_per_period: z.number().int().positive().nullable(),
  rate_limit_authenticated_creates_per_period: z.number().int().positive().nullable(),
  rate_limit_uploads_per_period: z.number().int().positive().nullable(),
  rate_limit_period_minutes: z.number().int().positive(),
  max_email_recipients_per_paste: z.number().int().positive().nullable(),
  invitation_expiry_days: z.number().int().positive().nullable(),
  registration_enabled: z.boolean(),
  public_paste_enabled: z.boolean(),
  require_2fa: z.boolean()
})

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  const body = await readValidatedBody(event, settingsSchema.parse)

  await db
    .insert(schema.appSettings)
    .values(Object.entries(body).map(([key, value]) => ({ key, value, updatedBy: session.user.id })))
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: sql`excluded.value`, updatedAt: new Date(), updatedBy: session.user.id }
    })

  await db.insert(schema.adminAuditLog).values({
    actorId: session.user.id,
    action: 'settings.update',
    details: body
  })

  return getSettings(APP_SETTINGS_KEYS)
})
