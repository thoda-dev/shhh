import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes } from 'node:crypto'

/**
 * Marks "an invitation token was already verified, this signup is legitimate" for the duration of a
 * single accept request. Read by the `/sign-up/email` hook in `server/utils/auth.ts`, which would
 * otherwise refuse the signup whenever `registration_enabled` is off.
 *
 * AsyncLocalStorage rather than a header or a body field: Better Auth's own endpoints are reachable
 * directly by any client, so anything carried in the request could simply be forged to bypass the
 * registration lock. This context can only be entered by our own accept route, after it has checked
 * the token — it is not reachable from outside the process.
 */
const invitedSignupContext = new AsyncLocalStorage<{ invitationId: string }>()

export function isInvitedSignup(): boolean {
  return invitedSignupContext.getStore() !== undefined
}

export function runAsInvitedSignup<T>(invitationId: string, fn: () => Promise<T>): Promise<T> {
  return invitedSignupContext.run({ invitationId }, fn)
}

export function generateInvitationToken(): string {
  // 32 bytes — the token is the only thing standing between a stranger and an account on a closed
  // instance, so it is sized like a session secret, not like a coupon code.
  return randomBytes(32).toString('base64url')
}

export type InvitationRow = typeof schema.invitations.$inferSelect

/**
 * `expired` is derived, never a stored transition: a row keeps `status = 'pending'` past its
 * deadline and is judged at read time. Same approach as banned IPs and pastes elsewhere in the
 * project — no scheduled job has to run for the rule to hold.
 */
export function invitationState(invitation: InvitationRow): 'pending' | 'accepted' | 'revoked' | 'expired' {
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
