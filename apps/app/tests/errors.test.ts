import { describe, expect, it } from 'vitest'
import { fetchErrorMessages } from '../app/utils/errors'

describe('fetchErrorMessages', () => {
  it('returns both fields so each call site can apply its own precedence', () => {
    // Nitro routes set statusMessage, Better Auth sets message; call sites order them by whichever their endpoint populates.
    expect(fetchErrorMessages({ data: { statusMessage: 'a', message: 'b' } })).toEqual({ statusMessage: 'a', message: 'b' })
  })

  it('returns only what is present', () => {
    expect(fetchErrorMessages({ data: { statusMessage: 'only' } })).toEqual({ statusMessage: 'only', message: undefined })
    expect(fetchErrorMessages({ data: { message: 'only' } })).toEqual({ statusMessage: undefined, message: 'only' })
  })

  it('copes with everything a failed fetch can actually throw', () => {
    // A network failure, an aborted request or a non-JSON response carry none of this shape.
    expect(fetchErrorMessages(undefined)).toEqual({})
    expect(fetchErrorMessages(null)).toEqual({})
    expect(fetchErrorMessages(new Error('network'))).toEqual({})
    expect(fetchErrorMessages('a string')).toEqual({})
    expect(fetchErrorMessages({ data: null })).toEqual({})
    expect(fetchErrorMessages({ data: 'plain text body' })).toEqual({})
  })

  it('ignores non-string fields rather than passing them to the UI', () => {
    expect(fetchErrorMessages({ data: { statusMessage: 500, message: { nested: true } } }))
      .toEqual({ statusMessage: undefined, message: undefined })
  })
})
