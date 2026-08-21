import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes } from 'node:crypto'

/**
 * Marks a signup as coming from an already-verified invitation token, for the duration of one accept request.
 * Read by the `/sign-up/email` hook, which would otherwise refuse it whenever `registration_enabled` is off.
 * AsyncLocalStorage rather than a header or body field: anything carried in the request could be forged, while this context is only reachable from our own accept route.
 */
const invitedSignupContext = new AsyncLocalStorage<{ invitationId: string }>()

export function isInvitedSignup(): boolean {
  return invitedSignupContext.getStore() !== undefined
}

export function runAsInvitedSignup<T>(invitationId: string, fn: () => Promise<T>): Promise<T> {
  return invitedSignupContext.run({ invitationId }, fn)
}

export function generateInvitationToken(): string {
  // 32 bytes: the only thing between a stranger and an account on a closed instance, so it is sized like a session secret.
  return randomBytes(32).toString('base64url')
}

export type InvitationRow = typeof schema.invitations.$inferSelect

/**
 * `expired` is derived, never a stored transition: a row stays 'pending' past its deadline and is judged at read time.
 * Same as banned IPs and pastes — no scheduled job has to run for the rule to hold.
 */
export function invitationState(
  // Only the two fields the rule reads, so the admin list route can pass its token-less projection without casting.
  invitation: Pick<InvitationRow, 'status' | 'expiresAt'>
): 'pending' | 'accepted' | 'revoked' | 'expired' {
  if (invitation.status === 'pending' && invitation.expiresAt.getTime() <= Date.now()) {
    return 'expired'
  }
  return invitation.status
}

export async function findUsableInvitation(token: string): Promise<InvitationRow | null> {
  const [invitation] = await db
    .select()
    .from(schema.invitations)
    .where(eq(schema.invitations.token, token))
    .limit(1)

  if (!invitation || invitationState(invitation) !== 'pending') return null
  return invitation
}
