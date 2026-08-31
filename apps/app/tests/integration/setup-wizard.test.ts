import { beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { eq } from 'drizzle-orm'
import { ApiClient, json } from './support/client'
import { db, resetDatabase, schema } from './support/database'
import { PASSWORD, SETUP_SETTINGS, completeSetupWizard, setupBody, uniqueEmail } from './support/fixtures'

/** The path that shipped broken in v1.1.0 and v1.1.1, with every other check green. */
describe('setup wizard', () => {
  beforeAll(async () => {
    await setup({ host: inject('baseUrl') })
  })

  beforeEach(resetDatabase)

  it('reports an empty instance as not set up', async () => {
    const response = await new ApiClient().get('/api/setup/status')
    expect(response.status).toBe(200)
    expect(await json(response)).toEqual({ completed: false })
  })

  it('creates a verified super admin and signs the caller in', async () => {
    const client = new ApiClient()
    const body = setupBody()

    const response = await client.post('/api/setup/complete', body)

    expect(response.status).toBe(201)
    expect(await json(response)).toMatchObject({ name: body.name, email: body.email })

    const [created] = await db.select().from(schema.users).where(eq(schema.users.email, body.email))
    expect(created).toBeDefined()
    // Neither is a sign-up input: completing the wizard is what proves both.
    expect(created!.role).toBe('super_admin')
    expect(created!.emailVerified).toBe(true)

    // The wizard ends signed in, not on a login screen.
    expect((await client.get('/api/admin/settings')).status).toBe(200)
  })

  it('stores the settings the wizard submitted', async () => {
    await completeSetupWizard()

    const rows = await db.select().from(schema.appSettings)
    const stored = Object.fromEntries(rows.map(row => [row.key, row.value]))

    expect(stored).toMatchObject(SETUP_SETTINGS)
    // A row holding null is a deliberate "unlimited", so it has to be written rather than skipped.
    expect(Object.keys(stored)).toContain('rate_limit_anonymous_creates_per_period')
    expect(stored.rate_limit_anonymous_creates_per_period).toBeNull()
  })

  it('flips the status endpoint once a super admin exists', async () => {
    await completeSetupWizard()
    expect(await json(await new ApiClient().get('/api/setup/status'))).toEqual({ completed: true })
  })

  it('refuses a second run', async () => {
    await completeSetupWizard()

    const response = await new ApiClient().post('/api/setup/complete', setupBody())

    expect(response.status).toBe(409)
    // The second call must not have created an account on its way to the conflict.
    const superAdmins = await db.select().from(schema.users).where(eq(schema.users.role, 'super_admin'))
    expect(superAdmins).toHaveLength(1)
  })

  it('serialises concurrent runs into a single super admin', async () => {
    // The advisory lock has to survive the pool: held on one connection and released on another, it leaks and every later run blocks forever.
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => new ApiClient().post('/api/setup/complete', setupBody()))
    )

    expect(responses.map(response => response.status).sort((a, b) => a - b)).toEqual([201, 409, 409, 409, 409])
    expect(await db.select().from(schema.users)).toHaveLength(1)
  })

  it('rejects a payload missing the settings block', async () => {
    const { settings: _settings, ...withoutSettings } = setupBody()

    const response = await new ApiClient().post('/api/setup/complete', withoutSettings)

    expect(response.status).toBe(400)
    expect(await db.select().from(schema.users)).toHaveLength(0)
  })
})

describe('sign-up', () => {
  beforeAll(async () => {
    await setup({ host: inject('baseUrl') })
  })

  beforeEach(resetDatabase)

  it('creates a plain user and signs it in', async () => {
    await completeSetupWizard()

    const client = new ApiClient()
    const email = uniqueEmail('member')
    const response = await client.post('/api/auth/sign-up/email', { name: 'Member', email, password: PASSWORD })

    expect(response.status).toBe(200)

    const [created] = await db.select().from(schema.users).where(eq(schema.users.email, email))
    expect(created!.role).toBe('user')

    expect((await client.get('/api/pastes')).status).toBe(200)
  })

  it('ignores a role the sign-up body asks for', async () => {
    await completeSetupWizard()

    const email = uniqueEmail('climber')
    const response = await new ApiClient().post('/api/auth/sign-up/email', {
      name: 'Climber',
      email,
      password: PASSWORD,
      role: 'super_admin'
    })

    expect(response.status).toBe(200)
    const [created] = await db.select().from(schema.users).where(eq(schema.users.email, email))
    expect(created!.role).toBe('user')
  })

  it('is refused while registration is disabled', async () => {
    const superAdmin = await completeSetupWizard()
    await db
      .insert(schema.appSettings)
      .values({ key: 'registration_enabled', value: false, updatedBy: superAdmin.id })
      .onConflictDoUpdate({ target: schema.appSettings.key, set: { value: false } })

    const response = await new ApiClient().post('/api/auth/sign-up/email', {
      name: 'Uninvited',
      email: uniqueEmail('uninvited'),
      password: PASSWORD
    })

    expect(response.status).toBe(403)
  })

  it('lets the wizard through even with registration disabled', async () => {
    // The bypass is proven from `isSetupComplete()`, so this cannot lock the first account out.
    await db.insert(schema.appSettings).values({ key: 'registration_enabled', value: false })

    const response = await new ApiClient().post('/api/setup/complete', setupBody())

    expect(response.status).toBe(201)
  })
})
