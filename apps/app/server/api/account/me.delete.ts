import { z } from 'zod'

const deleteAccountSchema = z.object({
  password: z.string().min(1),
  // Typing your own address back. Section 8 asks for strong confirmation and accepts either a
  // password or a confirmation phrase — requiring both makes the guard real at the API level too,
  // not just a modal the UI could skip.
  confirmation: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const session = await getAuthSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const body = await readValidatedBody(event, deleteAccountSchema.parse)

  // System account, deliberately outside the individual right to erasure (project.md sections 7
  // and 8). Demoting oneself is blocked too, so there is no way around this by design.
  if (session.user.role === 'super_admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'The super admin account cannot be deleted. Transfer the role to another account first.'
    })
  }

  if (body.confirmation.trim().toLowerCase() !== session.user.email.toLowerCase()) {
    throw createError({ statusCode: 400, statusMessage: 'Confirmation does not match your email address' })
  }

  // Better Auth stores the password hash on `accounts`, not `users`, and exposes no "verify this
  // password" primitive — a sign-in attempt is the supported way to check it. A correct password on
  // a 2FA-enabled account returns a two-factor challenge instead of a session; either outcome
  // proves the password, and any session row it creates dies with the cascade below.
  try {
    await auth.api.signInEmail({
      body: { email: session.user.email, password: body.password },
      headers: event.headers
    })
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Incorrect password' })
  }

  // One statement is already all-or-nothing, and the schema's foreign keys carry out the rest of
  // section 8 exactly: `cascade` removes accounts, sessions, two_factors, user_stats and pastes
  // (whose files and email recipients cascade in turn), while `set null` anonymises
  // `admin_audit_log.actor_id` and the `added_by` / `updated_by` / `invited_by` references.
  // No manual multi-table cleanup, and nothing left behind to drift.
  await db.delete(schema.users).where(eq(schema.users.id, session.user.id))

  setResponseStatus(event, 204)
  return null
})
