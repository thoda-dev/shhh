import type { H3Event } from 'h3'
import { betterAuth } from 'better-auth'
import { twoFactor } from 'better-auth/plugins/two-factor'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db, schema } from './database'

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET is not set')
}

if (!process.env.BETTER_AUTH_URL) {
  throw new Error('BETTER_AUTH_URL is not set')
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true
  },
  user: {
    modelName: 'users',
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
  ]
})

export function getAuthSession(event: H3Event) {
  return auth.api.getSession({ headers: event.headers })
}

const ADMIN_ROLES = new Set(['admin', 'super_admin'])

export async function requireAdminSession(event: H3Event) {
  const session = await getAuthSession(event)
  if (!session || !ADMIN_ROLES.has(session.user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
  }
  return session
}

export async function requireSuperAdminSession(event: H3Event) {
  const session = await getAuthSession(event)
  if (!session || session.user.role !== 'super_admin') {
    throw createError({ statusCode: 403, statusMessage: 'Super admin access required' })
  }
  return session
}
