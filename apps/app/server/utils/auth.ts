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
      // Without this, Better Auth can't resolve a caller behind a proxy and falls back to one shared
      // rate-limit bucket, so a single attacker throttles everyone's sign-in attempts.
      // Better Auth resolves the header itself and fails closed: with more than one entry and no
      // `trustedProxies` configured it returns no address rather than guessing, so a forged entry
      // cannot be mistaken for the client. That also means the shared-bucket fallback comes back
      // when two proxies are chained — the warning in the container logs is the symptom.
      // Our own abuse controls don't go through this; they use `getClientIp` and TRUSTED_PROXY_DEPTH.
      ipAddressHeaders: ['x-forwarded-for']
    }
  },
  emailAndPassword: {
    enabled: true,
    // Narrower than it looks: the setup wizard and invitation acceptance verify the address themselves, so this gates public self-registration only.
    requireEmailVerification: isMailEnabled(),
    // Without a provider there is no way to deliver a reset link, so resetting becomes a manual admin action.
    sendResetPassword: isMailEnabled()
      ? async ({ user, url }) => {
        const mail = resetPasswordTemplate({ url })
        await sendMail({ to: user.email, ...mail })
      }
      : undefined
  },
  emailVerification: {
    // Same reasoning: an instance running without mail must stay usable.
    sendOnSignUp: isMailEnabled(),
    // Re-sends on a sign-in by an unverified account: a lost first mail would otherwise lock the user out for good.
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
      // Only with a provider: the confirmation goes to the *current* address, which is what stops a hijacked session from moving the account.
      enabled: isMailEnabled(),
      // False even for unverified accounts: skipping confirmation would make the check avoidable by simply never verifying.
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
      // The schema export's key (`twoFactors`), not the SQL table name: the drizzle adapter does an exact `schema[twoFactorTable]` lookup.
      twoFactorTable: 'twoFactors'
    })
  ],
  hooks: {
    // Better Auth serves its own endpoints through the catch-all, so these app_settings switches have no handler of ours to live in.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-up/email') {
        // Two ways past a closed registration, both proven server-side: the setup wizard, and a validated invitation.
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
 * Callers that already read the setting pass it in to avoid a second query.
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
