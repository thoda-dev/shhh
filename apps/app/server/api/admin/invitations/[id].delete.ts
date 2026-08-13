import { z } from 'zod'

const paramsSchema = z.object({ id: z.uuid() })

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)

  // Revoked, not deleted: the audit trail of who invited whom is worth keeping, and an accepted
  // invitation must stay on record. Scoped to 'pending' so an already accepted account can't be
  // retroactively "un-invited" — that would be a user deletion, which lives elsewhere.
  const [invitation] = await db
    .update(schema.invitations)
    .set({ status: 'revoked' })
    .where(and(eq(schema.invitations.id, id), eq(schema.invitations.status, 'pending')))
    .returning({ id: schema.invitations.id, email: schema.invitations.email })

  if (!invitation) {
    throw createError({ statusCode: 404, statusMessage: 'No pending invitation with this id' })
  }

  await db.insert(schema.adminAuditLog).values({
    actorId: session.user.id,
    action: 'invitation.revoke',
    targetId: invitation.id,
    details: { email: invitation.email }
  })

  return invitation
})
