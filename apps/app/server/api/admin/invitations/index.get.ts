export default defineEventHandler(async (event) => {
  await requireAdminSession(event)

  const rows = await db
    .select({
      id: schema.invitations.id,
      email: schema.invitations.email,
      status: schema.invitations.status,
      expiresAt: schema.invitations.expiresAt,
      createdAt: schema.invitations.createdAt,
      acceptedAt: schema.invitations.acceptedAt,
      invitedByEmail: schema.users.email
    })
    .from(schema.invitations)
    .leftJoin(schema.users, eq(schema.invitations.invitedBy, schema.users.id))
    .orderBy(desc(schema.invitations.createdAt))

  // The token is never returned, not even to an admin: the invitation link is delivered by email
  // and nowhere else, so a leaked admin response can't be replayed into an account.
  return rows.map(row => ({ ...row, state: invitationState(row as InvitationRow) }))
})
