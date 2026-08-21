import { z } from 'zod'

const deleteAccountSchema = z.object({
  password: z.string().min(1),
  // Typing your own address back. Requiring both password and phrase makes the guard real at the API level, not just in the modal.
  confirmation: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const body = await readValidatedBody(event, deleteAccountSchema.parse)

  // System account, deliberately outside the individual right to erasure. Demoting oneself is blocked too, so there is no way around this by design.
  if (session.user.role === 'super_admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'The super admin account cannot be deleted. Transfer the role to another account first.'
    })
  }

  if (body.confirmation.trim().toLowerCase() !== session.user.email.toLowerCase()) {
    throw createError({ statusCode: 400, statusMessage: 'Confirmation does not match your email address' })
  }

  // Better Auth exposes no "verify this password" primitive, so a sign-in attempt is the supported way to check it.
  // On a 2FA account it returns a challenge instead of a session; either outcome proves the password, and any session row dies with the cascade below.
  try {
    await auth.api.signInEmail({
      body: { email: session.user.email, password: body.password },
      headers: event.headers
    })
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Incorrect password' })
  }

  // One all-or-nothing statement; the foreign keys do the rest.
  // `cascade` removes accounts, sessions, two_factors, user_stats and pastes; `set null` anonymises the audit log.
  await db.delete(schema.users).where(eq(schema.users.id, session.user.id))

  setResponseStatus(event, 204)
  return null
})
