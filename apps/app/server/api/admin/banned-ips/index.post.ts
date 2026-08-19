import { z } from 'zod'

const banIpSchema = z.object({
  ip: z.union([z.ipv4(), z.ipv6()]),
  reason: z.string().min(1).max(255),
  expiresAt: z.string().datetime().nullable().optional()
})

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  const body = await readValidatedBody(event, banIpSchema.parse)

  const [banned] = await db
    .insert(schema.bannedIps)
    .values({ ip: body.ip, reason: body.reason, expiresAt: body.expiresAt ? new Date(body.expiresAt) : null })
    .onConflictDoUpdate({
      target: schema.bannedIps.ip,
      set: { reason: body.reason, expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }
    })
    .returning()

  if (!banned) {
    throw createError({ statusCode: 500, statusMessage: 'Could not create the ban' })
  }

  await db.insert(schema.adminAuditLog).values({
    actorId: session.user.id,
    action: 'banned_ip.create',
    targetId: banned.id,
    details: { ip: body.ip, reason: body.reason, expiresAt: body.expiresAt ?? null }
  })

  setResponseStatus(event, 201)
  return banned
})
