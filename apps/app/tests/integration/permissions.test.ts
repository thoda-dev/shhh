import { beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { ApiClient } from './support/client'
import { resetDatabase } from './support/database'
import { TURNSTILE_TEST_TOKEN } from './support/env'
import { completeSetupWizard, createPasteRow, createUserRow, signUpIdentity } from './support/fixtures'

type Actor = 'anonymous' | 'user' | 'admin' | 'superAdmin'

const ACTORS: Actor[] = ['anonymous', 'user', 'admin', 'superAdmin']

interface Instance {
  clients: Record<Actor, ApiClient>
  self: Record<Exclude<Actor, 'anonymous'>, string>
  ownPaste: Record<Actor, string>
  otherPaste: string
  targetUser: string
  targetAdmin: string
}

/** Every field `PUT /api/admin/settings` validates, on the shipped defaults, so a write changes nothing. */
const FULL_SETTINGS = {
  max_retention_days_anonymous: 7,
  max_retention_days_authenticated: 30,
  max_reads_anonymous: null,
  max_reads_authenticated: null,
  max_text_size_bytes: 100_000,
  max_upload_size_bytes: 2_000_000,
  max_total_pastes: null,
  max_total_storage_bytes: 40_000_000_000,
  rate_limit_anonymous_creates_per_period: null,
  rate_limit_authenticated_creates_per_period: null,
  rate_limit_uploads_per_period: null,
  rate_limit_period_minutes: 10,
  max_email_recipients_per_paste: 3,
  invitation_expiry_days: 7,
  registration_enabled: true,
  public_paste_enabled: true,
  require_2fa: false
}

function textPaste() {
  return {
    kind: 'text',
    ciphertext: Buffer.from('ciphertext').toString('base64'),
    iv: Buffer.from('123456789012').toString('base64'),
    turnstileToken: TURNSTILE_TEST_TOKEN
  }
}

/** A fresh instance per assertion: half the matrix deletes accounts or moves roles. */
async function createInstance(): Promise<Instance> {
  const superAdmin = await completeSetupWizard()
  const admin = await signUpIdentity('admin')
  const user = await signUpIdentity('user')

  const targetUser = await createUserRow('user')
  const targetAdmin = await createUserRow('admin')

  return {
    clients: { anonymous: new ApiClient(), user: user.client, admin: admin.client, superAdmin: superAdmin.client },
    self: { user: user.id, admin: admin.id, superAdmin: superAdmin.id },
    ownPaste: {
      anonymous: (await createPasteRow(null)).id,
      user: (await createPasteRow(user.id)).id,
      admin: (await createPasteRow(admin.id)).id,
      superAdmin: (await createPasteRow(superAdmin.id)).id
    },
    otherPaste: (await createPasteRow(targetUser.id)).id,
    targetUser: targetUser.id,
    targetAdmin: targetAdmin.id
  }
}

interface Case {
  label: string
  expected: Record<Actor, number>
  call: (instance: Instance, actor: Actor) => Promise<Response>
}

/** The table in `apps/docs/content/2.self-hosting/3.security.md`, as status codes rather than ticks. */
const MATRIX: Record<string, Case[]> = {
  'Manage own pastes': [
    {
      label: 'POST /api/pastes',
      // Anonymous creation is the product; `public_paste_enabled` is what turns it off.
      expected: { anonymous: 201, user: 201, admin: 201, superAdmin: 201 },
      call: (instance, actor) => instance.clients[actor].post('/api/pastes', textPaste())
    },
    {
      label: 'GET /api/pastes',
      expected: { anonymous: 401, user: 200, admin: 200, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].get('/api/pastes')
    },
    {
      label: 'DELETE /api/pastes/{own}',
      expected: { anonymous: 401, user: 204, admin: 204, superAdmin: 204 },
      call: (instance, actor) => instance.clients[actor].delete(`/api/pastes/${instance.ownPaste[actor]}`)
    },
    {
      label: 'DELETE /api/pastes/{someone else\'s}',
      // 404, not 403: ownership is in the WHERE clause, and a super admin has no override here either.
      expected: { anonymous: 401, user: 404, admin: 404, superAdmin: 404 },
      call: (instance, actor) => instance.clients[actor].delete(`/api/pastes/${instance.otherPaste}`)
    }
  ],

  'Change settings, view stats': [
    {
      label: 'GET /api/admin/settings',
      expected: { anonymous: 403, user: 403, admin: 200, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].get('/api/admin/settings')
    },
    {
      label: 'PUT /api/admin/settings',
      expected: { anonymous: 403, user: 403, admin: 200, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].put('/api/admin/settings', FULL_SETTINGS)
    },
    {
      label: 'GET /api/admin/storage',
      // Stricter than the documented row: storage is super admin only, as `AdminNav.vue` already says.
      expected: { anonymous: 403, user: 403, admin: 403, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].get('/api/admin/storage')
    }
  ],

  'Create and delete user accounts': [
    {
      label: 'GET /api/admin/users',
      expected: { anonymous: 403, user: 403, admin: 200, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].get('/api/admin/users')
    },
    {
      label: 'POST /api/admin/invitations',
      // 503 is the pass: this instance has no mail provider, and that check sits past the gate.
      expected: { anonymous: 403, user: 403, admin: 503, superAdmin: 503 },
      call: (instance, actor) => instance.clients[actor].post('/api/admin/invitations', { email: 'invitee@example.test' })
    },
    {
      label: 'DELETE /api/admin/users/{user}',
      expected: { anonymous: 403, user: 403, admin: 200, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].delete(`/api/admin/users/${instance.targetUser}`)
    }
  ],

  'Act on admin / super admin accounts': [
    {
      label: 'DELETE /api/admin/users/{admin}',
      expected: { anonymous: 403, user: 403, admin: 403, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].delete(`/api/admin/users/${instance.targetAdmin}`)
    },
    {
      label: 'DELETE /api/admin/users/{id}/pastes',
      expected: { anonymous: 403, user: 403, admin: 403, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].delete(`/api/admin/users/${instance.targetUser}/pastes?scope=all`)
    }
  ],

  'Change anyone\'s role': [
    {
      label: 'PATCH /api/admin/users/{user}',
      expected: { anonymous: 403, user: 403, admin: 403, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].patch(`/api/admin/users/${instance.targetUser}`, { role: 'admin' })
    },
    {
      label: 'PATCH /api/admin/users/{admin}',
      expected: { anonymous: 403, user: 403, admin: 403, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].patch(`/api/admin/users/${instance.targetAdmin}`, { role: 'user' })
    }
  ],

  // Not a documented row, but the same gate, and leaving it untested is how one of these quietly loosens.
  'The rest of the admin surface': [
    {
      label: 'GET /api/admin/invitations',
      expected: { anonymous: 403, user: 403, admin: 200, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].get('/api/admin/invitations')
    },
    {
      label: 'GET /api/admin/banned-ips',
      expected: { anonymous: 403, user: 403, admin: 200, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].get('/api/admin/banned-ips')
    },
    {
      label: 'GET /api/admin/allowed-ips',
      expected: { anonymous: 403, user: 403, admin: 200, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].get('/api/admin/allowed-ips')
    },
    {
      label: 'POST /api/admin/pastes/purge',
      expected: { anonymous: 403, user: 403, admin: 403, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].post('/api/admin/pastes/purge')
    },
    {
      label: 'GET /api/admin/legal',
      expected: { anonymous: 403, user: 403, admin: 403, superAdmin: 200 },
      call: (instance, actor) => instance.clients[actor].get('/api/admin/legal')
    }
  ]
}

describe('permission matrix', () => {
  beforeAll(async () => {
    await setup({ host: inject('baseUrl') })
  })

  beforeEach(resetDatabase)

  for (const [row, cases] of Object.entries(MATRIX)) {
    describe(row, () => {
      for (const testCase of cases) {
        for (const actor of ACTORS) {
          it(`${testCase.label} — ${actor} gets ${testCase.expected[actor]}`, async () => {
            const instance = await createInstance()
            const response = await testCase.call(instance, actor)
            expect(response.status, await response.clone().text()).toBe(testCase.expected[actor])
          })
        }
      }
    })
  }
})

/** "Nobody can delete or demote themselves, whatever their role." */
describe('nobody acts on their own account', () => {
  beforeAll(async () => {
    await setup({ host: inject('baseUrl') })
  })

  beforeEach(resetDatabase)

  it('an admin cannot delete itself from the admin routes', async () => {
    const instance = await createInstance()
    const response = await instance.clients.admin.delete(`/api/admin/users/${instance.self.admin}`)
    expect(response.status).toBe(403)
  })

  it('a super admin cannot delete itself from the admin routes', async () => {
    const instance = await createInstance()
    const response = await instance.clients.superAdmin.delete(`/api/admin/users/${instance.self.superAdmin}`)
    expect(response.status).toBe(403)
  })

  it('a super admin cannot change its own role', async () => {
    const instance = await createInstance()
    const response = await instance.clients.superAdmin.patch(`/api/admin/users/${instance.self.superAdmin}`, { role: 'user' })
    expect(response.status).toBe(403)
  })

  it('a super admin cannot delete its own account', async () => {
    // The system account is outside the right to erasure, and it cannot demote itself either.
    const instance = await createInstance()
    const response = await instance.clients.superAdmin.delete('/api/account/me', {
      password: 'integration-test-password',
      confirmation: 'anything'
    })
    expect(response.status).toBe(403)
  })
})
