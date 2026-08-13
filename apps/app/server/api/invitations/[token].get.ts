import { z } from 'zod'

const paramsSchema = z.object({ token: z.string().min(1).max(256) })

/**
 * Public: /register needs to know, before any account exists, whether the token in the URL is good
 * and which address it was issued to. Consumes nothing — the invitation is only spent on accept.
 */
export default defineEventHandler(async (event) => {
  const { token } = await getValidatedRouterParams(event, paramsSchema.parse)

  const invitation = await findUsableInvitation(token)
  if (!invitation) {
    // Deliberately one undifferentiated 404 for unknown / expired / revoked / already accepted:
    // this endpoint is unauthenticated, and distinguishing them would let anyone probe which
    // tokens once existed.
    throw createError({ statusCode: 404, statusMessage: 'This invitation link is not valid' })
  }

  return { email: invitation.email, expiresAt: invitation.expiresAt }
})
