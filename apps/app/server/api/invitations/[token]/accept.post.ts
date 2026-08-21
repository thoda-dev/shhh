import { z } from 'zod'

const paramsSchema = z.object({ token: z.string().min(1).max(256) })

const acceptSchema = z.object({
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(128)
})

export default defineEventHandler(async (event) => {
  const { token } = await getValidatedRouterParams(event, paramsSchema.parse)
  const body = await readValidatedBody(event, acceptSchema.parse)

  const invitation = await findUsableInvitation(token)
  if (!invitation) {
    throw createError({ statusCode: 404, statusMessage: 'This invitation link is not valid' })
  }

  // Email comes from the invitation row, never the request: a token must not open an account under any address.
  // Role is always 'user'; `input: false` on the Better Auth model already guarantees it.
  const { headers, response } = await runAsInvitedSignup(invitation.id, () =>
    auth.api.signUpEmail({
      body: { name: body.name, email: invitation.email, password: body.password },
      headers: event.headers,
      returnHeaders: true
    })
  )

  // Single-use: scoped to 'pending' so two concurrent accepts can't both consume the token — the second matches no row and its account is rolled back below.
  const [consumed] = await db
    .update(schema.invitations)
    .set({ status: 'accepted', acceptedAt: new Date() })
    .where(and(eq(schema.invitations.id, invitation.id), eq(schema.invitations.status, 'pending')))
    .returning({ id: schema.invitations.id })

  if (!consumed) {
    await db.delete(schema.users).where(eq(schema.users.id, response.user.id))
    throw createError({ statusCode: 409, statusMessage: 'This invitation has already been used' })
  }

  // The invited address was proven by the fact the link only reached that mailbox.
  await db
    .update(schema.users)
    .set({ emailVerified: true })
    .where(eq(schema.users.id, response.user.id))

  for (const cookie of headers.getSetCookie()) {
    appendResponseHeader(event, 'set-cookie', cookie)
  }

  setResponseStatus(event, 201)
  return { id: response.user.id, name: response.user.name, email: response.user.email }
})
