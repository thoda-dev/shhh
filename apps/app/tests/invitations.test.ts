import { describe, expect, it } from 'vitest'
import {
  generateInvitationToken,
  invitationState,
  isInvitedSignup,
  runAsInvitedSignup
} from '../server/utils/invitations'

const HOUR = 60 * 60 * 1000
const future = () => new Date(Date.now() + HOUR)
const past = () => new Date(Date.now() - HOUR)

describe('invitationState', () => {
  it('is pending while the deadline is ahead', () => {
    expect(invitationState({ status: 'pending', expiresAt: future() })).toBe('pending')
  })

  it('derives expired from the deadline rather than the stored status', () => {
    // Nothing flips the row to 'expired' on a schedule, so the rule has to hold on read.
    expect(invitationState({ status: 'pending', expiresAt: past() })).toBe('expired')
  })

  it('keeps accepted and revoked whatever the deadline says', () => {
    expect(invitationState({ status: 'accepted', expiresAt: past() })).toBe('accepted')
    expect(invitationState({ status: 'revoked', expiresAt: past() })).toBe('revoked')
    expect(invitationState({ status: 'accepted', expiresAt: future() })).toBe('accepted')
  })

  it('treats the exact deadline as already expired', () => {
    expect(invitationState({ status: 'pending', expiresAt: new Date(Date.now()) })).toBe('expired')
  })
})

describe('generateInvitationToken', () => {
  it('is URL-safe, so it survives being emailed as a query parameter', () => {
    expect(generateInvitationToken()).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('carries 32 bytes of entropy', () => {
    // 32 random bytes in base64url, unpadded. This token is the only thing between a stranger
    // and an account on a closed instance, so its size is a security property.
    expect(generateInvitationToken()).toHaveLength(43)
  })

  it('never repeats', () => {
    const tokens = new Set(Array.from({ length: 500 }, generateInvitationToken))
    expect(tokens.size).toBe(500)
  })
})

describe('invited signup context', () => {
  it('is off by default', () => {
    expect(isInvitedSignup()).toBe(false)
  })

  it('is on inside the callback and off again afterwards', async () => {
    await runAsInvitedSignup('inv-1', async () => {
      expect(isInvitedSignup()).toBe(true)
    })
    expect(isInvitedSignup()).toBe(false)
  })

  it('survives awaits inside the callback', async () => {
    // The whole point is that it holds for the duration of an async request handler.
    await runAsInvitedSignup('inv-1', async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(isInvitedSignup()).toBe(true)
    })
  })

  it('does not leak into concurrent work outside it', async () => {
    // If the flag leaked across async contexts, a single invited signup would open the
    // registration bypass for every request running at the same time.
    let leaked: boolean | null = null
    const outside = (async () => {
      await new Promise(resolve => setTimeout(resolve, 5))
      leaked = isInvitedSignup()
    })()

    await runAsInvitedSignup('inv-1', async () => {
      await new Promise(resolve => setTimeout(resolve, 20))
    })
    await outside

    expect(leaked).toBe(false)
  })

  it('clears the context even when the callback throws', async () => {
    await expect(runAsInvitedSignup('inv-1', async () => {
      throw new Error('signup failed')
    })).rejects.toThrow('signup failed')
    expect(isInvitedSignup()).toBe(false)
  })

  it('returns whatever the callback returns', async () => {
    await expect(runAsInvitedSignup('inv-1', async () => 'created')).resolves.toBe('created')
  })
})
