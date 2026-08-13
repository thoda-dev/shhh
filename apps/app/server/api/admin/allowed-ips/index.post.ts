import { z } from 'zod'

const createAllowedIpSchema = z.object({
  ip: z.union([z.ipv4(), z.ipv6()]),
  label: z.string().min(1).max(255).optional()
})

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  const body = await readValidatedBody(event, createAllowedIpSchema.parse)

  const [allowedIp] = await db
    .insert(schema.allowedIps)
    .values({ ip: body.ip, label: body.label, addedBy: session.user.id })
    .onConflictDoNothing({ target: schema.allowedIps.ip })
    .returning()

  if (!allowedIp) {
    throw createError({ statusCode: 409, statusMessage: 'This IP is already allowlisted' })
  }

  await db.insert(schema.adminAuditLog).values({
    actorId: session.user.id,
    action: 'allowed_ip.create',
    targetId: allowedIp.id,
    details: { ip: body.ip, label: body.label ?? null }
  })

  setResponseStatus(event, 201)
  return allowedIp
})
