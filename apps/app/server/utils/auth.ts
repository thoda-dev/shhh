import type { H3Event } from 'h3'
import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { twoFactor } from 'better-auth/plugins/two-factor'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db, schema } from './database'
import { getSetting } from './settings'
import { isSetupComplete } from './setup'
import { isInvitedSignup } from './invitations'
import { isMailEnabled, sendMail } from './mail'
import { resetPasswordTemplate, verifyEmailTemplate } from './mail-templates'

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET is not set')
}

if (!process.env.BETTER_AUTH_URL) {
  throw new Error('BETTER_AUTH_URL is not set')
}

export const TWO_FACTOR_REQUIRED_MESSAGE = 'Two-factor authentication is required on this instance'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  advanced: {
    ipAddress: {
      // Without this, Better Auth can't resolve a client IP behind a container/proxy and falls back
      // to one shared rate-limit bucket for every caller — meaning a single attacker throttles
      // everyone's sign-in attempts. Surfaced by a warning in the container logs, not in dev.
      //
      // This matches what the rest of the app already does (`getRequestIP(event, { xForwardedFor: true })`)
      // and carries the same deployment requirement: the instance must sit behind a reverse proxy
      // that overwrites X-Forwarded-For rather than appending to a client-supplied value.
      ipAddressHeaders: ['x-forwarded-for']
    }
  },
  emailAndPassword: {
    enabled: true,
    // Only meaningful when a provider is configured; with MAIL_PROVIDER='none' nobody could ever
    // verify and the instance would be unusable. Scope is narrower than it looks: the setup wizard
    // and invitation acceptance both mark the address verified themselves, so the only path this
    // gates is public self-registration — exactly where an unverified address is a problem, since
    // it is also the address every password reset would be sent to.
    requireEmailVerification: isMailEnabled(),
    // With MAIL_PROVIDER='none' there is no way to deliver a reset link, so the flow is disabled
    // outright rather than left to fail silently — resetting a password becomes a manual admin
    // action in that configuration (project.md section 9).
    sendResetPassword: isMailEnabled()
      ? async ({ user, url }) => {
        const mail = resetPasswordTemplate({ url })
        await sendMail({ to: user.email, ...mail })
      }
      : undefined
  },
  emailVerification: {
    // Same reasoning: an instance running without mail must stay usable, so verification is only
    // required when a provider is actually configured.
    sendOnSignUp: isMailEnabled(),
    // Re-sends on a sign-in attempt by an unverified account. Without it, anyone whose first
    // verification mail was lost would be permanently locked out with no self-service way back.
    sendOnSignIn: isMailEnabled(),
    autoSignInAfterVerification: true,
    sendVerificationEmail: isMailEnabled()
      ? async ({ user, url }) => {
        const mail = verifyEmailTemplate({ url })
        await sendMail({ to: user.email, ...mail })
      }
      : undefined
  },
  user: {
    modelName: 'users',
    changeEmail: {
      // Only offered when a provider is configured: the confirmation goes to the *current* address,
      // which is what stops someone with a hijacked session from quietly moving the account to an
      // address they control. Without mail there is no such safeguard, so the flow stays off.
      enabled: isMailEnabled(),
      // Deliberately left at false even for unverified accounts — an unverified address is still the
      // one the operator sees, and skipping confirmation would make the check trivially avoidable by
      // simply never verifying.
      updateEmailWithoutVerification: false,
      sendChangeEmailConfirmation: isMailEnabled()
        ? async ({ user, newEmail, url }) => {
          const mail = changeEmailTemplate({ url, newEmail })
          await sendMail({ to: user.email, ...mail })
        }
        : undefined
    },
    additionalFields: {
      role: {
        type: 'string',
        required: true,
        defaultValue: 'user',
        input: false
      }
    }
  },
  session: {
    modelName: 'sessions'
  },
  account: {
    modelName: 'accounts'
  },
  verification: {
    modelName: 'verifications'
  },
  plugins: [
    twoFactor({
      // Must match the schema export's key (`twoFactors`), not the SQL table name — the drizzle
      // adapter does an exact `schema[twoFactorTable]` lookup, unrelated to the actual `pgTable('two_factors', ...)` name.
      twoFactorTable: 'twoFactors'
    })
  ],
  hooks: {
    // Better Auth exposes its own endpoints through the `/api/auth/[...all]` catch-all, so a couple
    // of app_settings switches can only be enforced here — there is no handler of ours to put them in.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-up/email') {
        // Two legitimate ways past a closed registration, both proven before we get here rather
        // than claimed by the caller:
        //  - the setup wizard, creating the very first super_admin through `auth.api.signUpEmail`
        //    (there is nothing to lock down before the instance exists);
        //  - an accept route that has already validated an invitation token (project.md section 7:
        //    an invitation is an explicit bypass of registration_enabled).
        const bypass = isInvitedSignup() || !(await isSetupComplete())
        if (!bypass && !(await getSetting('registration_enabled'))) {
          throw new APIError('FORBIDDEN', { message: 'Registration is disabled on this instance' })
        }
      }

      if (ctx.path === '/two-factor/disable') {
        // Without this, require_2fa would be trivially defeated: enroll, then turn it straight back off.
        if (await getSetting('require_2fa')) {
          throw new APIError('FORBIDDEN', { message: TWO_FACTOR_REQUIRED_MESSAGE })
        }
      }
    })
  }
})

export function getAuthSession(event: H3Event) {
  return auth.api.getSession({ headers: event.headers })
}

/**
 * Blocks an account that hasn't enrolled in 2FA while `app_settings.require_2fa` is on.
 * Callers that already read the setting (paste creation) pass it in to avoid a second query;
 * the others let it be fetched, but only once we know the user isn't enrolled anyway.
 * Never applies to Better Auth's own endpoints — enrolling would otherwise be impossible.
 */
export async function assertTwoFactorCompliance(
  user: { twoFactorEnabled?: boolean | null },
  required?: boolean
) {
  if (user.twoFactorEnabled) return
  if (required ?? (await getSetting('require_2fa'))) {
    throw createError({ statusCode: 403, statusMessage: TWO_FACTOR_REQUIRED_MESSAGE })
  }
}

const ADMIN_ROLES = new Set(['admin', 'super_admin'])

export async function requireAdminSession(event: H3Event) {
  const session = await getAuthSession(event)
  if (!session || !ADMIN_ROLES.has(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
  }
  await assertTwoFactorCompliance(session.user)
  return session
}

export async function requireSuperAdminSession(event: H3Event) {
  const session = await getAuthSession(event)
  if (!session || session.user.role !== 'super_admin') {
    throw createError({ statusCode: 403, statusMessage: 'Super admin access required' })
  }
  await assertTwoFactorCompliance(session.user)
  return session
}
