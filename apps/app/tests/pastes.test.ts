import { describe, expect, it } from 'vitest'
import { isPasteAccessible, pasteIdParamSchema } from '../server/utils/pastes'

const HOUR = 60 * 60 * 1000
const ahead = new Date(Date.now() + HOUR)
const behind = new Date(Date.now() - HOUR)

describe('isPasteAccessible', () => {
  it('accepts a live paste with reads to spare', () => {
    expect(isPasteAccessible({ expiresAt: ahead, maxReads: 3, readCount: 1 })).toBe(true)
  })

  it('rejects an expired paste even with reads left', () => {
    expect(isPasteAccessible({ expiresAt: behind, maxReads: 3, readCount: 0 })).toBe(false)
  })

  it('rejects an exhausted paste even before its deadline', () => {
    expect(isPasteAccessible({ expiresAt: ahead, maxReads: 3, readCount: 3 })).toBe(false)
  })

  it('rejects a paste read past its cap', () => {
    expect(isPasteAccessible({ expiresAt: ahead, maxReads: 1, readCount: 5 })).toBe(false)
  })

  it('treats a null cap as unlimited reads', () => {
    // null means "no limit", never "zero" — mixing those up would make every such paste dead.
    expect(isPasteAccessible({ expiresAt: ahead, maxReads: null, readCount: 9999 })).toBe(true)
  })

  it('still expires a paste with unlimited reads', () => {
    expect(isPasteAccessible({ expiresAt: behind, maxReads: null, readCount: 0 })).toBe(false)
  })

  it('rejects a one-read paste that has been read once', () => {
    expect(isPasteAccessible({ expiresAt: ahead, maxReads: 1, readCount: 1 })).toBe(false)
    expect(isPasteAccessible({ expiresAt: ahead, maxReads: 1, readCount: 0 })).toBe(true)
  })
})

describe('pasteIdParamSchema', () => {
  it('accepts a uuid', () => {
    expect(pasteIdParamSchema.safeParse('3f2504e0-4f89-41d3-9a0c-0305e82c3301').success).toBe(true)
  })

  it('rejects anything else, so a malformed id is a 400 and never a database error', () => {
    for (const bad of ['', 'not-a-uuid', '123', '3f2504e0-4f89-41d3-9a0c', '\' OR 1=1--']) {
      expect(pasteIdParamSchema.safeParse(bad).success).toBe(false)
    }
  })
})
