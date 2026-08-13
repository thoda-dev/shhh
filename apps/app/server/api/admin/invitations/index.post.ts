import { z } from 'zod'

const createInvitationSchema = z.object({
  email: z.string().email()
})

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)
  const body = await readValidatedBody(event, createInvitationSchema.parse)
  const email = body.email.trim().toLowerCase()

  if (!isMailEnabled()) {
    throw createError({ statusCode: 503, statusMessage: 'This instance has no mail provider configured' })
  }

  // Both duplicate checks from project.md section 7. The pending one is also enforced by a partial
  // unique index, but checking here turns a constraint violation into a readable 409.
  const [existingUser] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1)

  if (existingUser) {
    throw createError({ statusCode: 409, statusMessage: 'An account already exists for this email' })
  }

  const [pending] = await db
    .select()
    .from(schema.invitations)
    .where(and(eq(schema.invitations.email, email), eq(schema.invitations.status, 'pending')))
    .limit(1)

  // A pending row that has already lapsed shouldn't block a fresh invitation. Flipping it to
  // 'expired' here is what frees the partial unique index for the new row.
  if (pending) {
    if (invitationState(pending) === 'pending') {
      throw createError({ statusCode: 409, statusMessage: 'An invitation is already pending for this email' })
    }
    await db.update(schema.invitations).set({ status: 'expired' }).where(eq(schema.invitations.id, pending.id))
  }

  const expiryDays = await getSetting('invitation_expiry_days')
  // `null` means "no expiry configured"; the column is NOT NULL, so a far-future date stands in for
  // it rather than making every read handle a nullable deadline.
  const expiresAt = expiryDays === null
    ? new Date('9999-12-31T23:59:59Z')
    : new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)

  const token = generateInvitationToken()

  const [invitation] = await db
    .insert(schema.invitations)
    .values({ email, token, invitedBy: session.user.id, expiresAt })
    .returning({
      id: schema.invitations.id,
      email: schema.invitations.email,
      status: schema.invitations.status,
      expiresAt: schema.invitations.expiresAt,
      createdAt: schema.invitations.createdAt
    })

  // Same reasoning as paste sharing: built from BETTER_AUTH_URL rather than the request's Host
  // header, which is attacker-controllable behind a proxy and would land in an email.
  const origin = process.env.BETTER_AUTH_URL!.replace(/\/+$/, '')
  const mail = invitationTemplate({
    url: `${origin}/register?token=${token}`,
    expiresInDays: expiryDays
  })
  const sent = await sendMail({ to: email, ...mail })

  await db.insert(schema.adminAuditLog).values({
    actorId: session.user.id,
    action: 'invitation.create',
    targetId: invitation!.id,
    details: { email, sent }
  })

  setResponseStatus(event, 201)
  // The invitation row is kept even when delivery fails — an admin can revoke it and issue a new
  // one, which is more useful than silently having no trace of the attempt.
  return { ...invitation, sent }
})
