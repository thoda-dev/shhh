import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { ApiClient, json } from './client'
import { db, schema } from './database'

export type Role = 'user' | 'admin' | 'super_admin'

export const PASSWORD = 'integration-test-password'

let accounts = 0

export function uniqueEmail(prefix = 'user') {
  accounts += 1
  return `${prefix}-${accounts}-${randomUUID().slice(0, 8)}@example.test`
}

/** The nine keys the wizard insists on, with rate limits left unlimited so no suite throttles itself. */
export const SETUP_SETTINGS = {
  max_retention_days_anonymous: 7,
  max_retention_days_authenticated: 30,
  max_text_size_bytes: 100_000,
  max_upload_size_bytes: 2_000_000,
  max_total_storage_bytes: 40_000_000_000,
  rate_limit_anonymous_creates_per_period: null,
  rate_limit_authenticated_creates_per_period: null,
  rate_limit_uploads_per_period: null,
  rate_limit_period_minutes: 10
} as const

export interface SetupBody {
  name: string
  email: string
  password: string
  settings: typeof SETUP_SETTINGS
}

export function setupBody(overrides: Partial<SetupBody> = {}): SetupBody {
  return {
    name: 'Super Admin',
    email: uniqueEmail('super-admin'),
    password: PASSWORD,
    settings: SETUP_SETTINGS,
    ...overrides
  }
}

export interface Identity {
  client: ApiClient
  id: string
  email: string
}

/** The wizard over HTTP, exactly as `pages/setup.vue` runs it — the only way to get a super admin. */
export async function completeSetupWizard(overrides: Partial<SetupBody> = {}): Promise<Identity> {
  const client = new ApiClient()
  const body = setupBody(overrides)
  const response = await client.post('/api/setup/complete', body)
  if (response.status !== 201) {
    throw new Error(`setup wizard failed with ${response.status}: ${await response.text()}`)
  }
  const created = await json<{ id: string }>(response)
  return { client, id: created.id, email: body.email }
}

/** A signed-in account from the public sign-up, promoted afterwards if asked. */
export async function signUpIdentity(role: Exclude<Role, 'super_admin'> = 'user'): Promise<Identity> {
  const client = new ApiClient()
  const email = uniqueEmail(role)
  const response = await client.post('/api/auth/sign-up/email', { name: `Test ${role}`, email, password: PASSWORD })
  if (response.status !== 200) {
    throw new Error(`sign-up failed with ${response.status}: ${await response.text()}`)
  }
  const created = await json<{ user: { id: string } }>(response)
  if (role !== 'user') {
    await db.update(schema.users).set({ role }).where(eq(schema.users.id, created.user.id))
  }
  return { client, id: created.user.id, email }
}

/** A row, not a session: a deletion target never signs in, and skipping the password hash keeps fixtures cheap. */
export async function createUserRow(role: Role = 'user') {
  const [row] = await db
    .insert(schema.users)
    .values({ id: randomUUID(), name: `Target ${role}`, email: uniqueEmail(`target-${role}`), role })
    .returning({ id: schema.users.id, email: schema.users.email })
  return row!
}

export async function createPasteRow(ownerId: string | null) {
  const [row] = await db
    .insert(schema.pastes)
    .values({
      ownerId,
      kind: 'text',
      ciphertext: Buffer.from('ciphertext'),
      iv: Buffer.from('123456789012'),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    })
    .returning({ id: schema.pastes.id })
  return row!
}
