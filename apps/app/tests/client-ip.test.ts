import { describe, it, expect } from 'vitest'
import { resolveClientIp } from '../server/utils/client-ip'

const SOCKET = '10.0.0.5'

describe('resolveClientIp', () => {
  describe('with no trusted proxy (depth 0, the default)', () => {
    it('uses the socket address and ignores the header entirely', () => {
      expect(resolveClientIp(SOCKET, '1.2.3.4', 0)).toBe(SOCKET)
    })

    // The whole point of defaulting to 0: an app reachable directly must not believe a header.
    it('cannot be talked into trusting a forged header', () => {
      expect(resolveClientIp(SOCKET, '6.6.6.6, 6.6.6.7', 0)).toBe(SOCKET)
    })
  })

  describe('behind one proxy (depth 1)', () => {
    it('takes the address the proxy appended', () => {
      expect(resolveClientIp(SOCKET, '1.2.3.4', 1)).toBe('1.2.3.4')
    })

    // A proxy that appends rather than overwrites leaves the client's own value in front of the
    // real one. Counting from the right is what makes that harmless.
    it('ignores an entry the client prepended', () => {
      expect(resolveClientIp(SOCKET, '6.6.6.6, 1.2.3.4', 1)).toBe('1.2.3.4')
    })
  })

  describe('behind two proxies (depth 2)', () => {
    it('skips the intermediate proxy and returns the client', () => {
      expect(resolveClientIp(SOCKET, '1.2.3.4, 9.9.9.9', 2)).toBe('1.2.3.4')
    })

    it('still ignores a forged entry in front of the chain', () => {
      expect(resolveClientIp(SOCKET, '6.6.6.6, 1.2.3.4, 9.9.9.9', 2)).toBe('1.2.3.4')
    })
  })

  describe('when the chain is shorter than the configured depth', () => {
    // A request that skipped the proxies, so the header proves nothing. Falling back to the socket
    // is what stops someone reaching the app directly from choosing their own address.
    it('falls back to the socket address rather than trusting what is there', () => {
      expect(resolveClientIp(SOCKET, '6.6.6.6', 2)).toBe(SOCKET)
    })

    it('falls back when the header is absent', () => {
      expect(resolveClientIp(SOCKET, undefined, 2)).toBe(SOCKET)
    })

    it('falls back when the header is empty or only separators', () => {
      expect(resolveClientIp(SOCKET, '', 1)).toBe(SOCKET)
      expect(resolveClientIp(SOCKET, ' , , ', 1)).toBe(SOCKET)
    })
  })

  it('tolerates the whitespace real proxies emit around commas', () => {
    expect(resolveClientIp(SOCKET, '  1.2.3.4  ,   9.9.9.9  ', 2)).toBe('1.2.3.4')
  })

  it('returns undefined when there is no socket address and nothing to fall back on', () => {
    expect(resolveClientIp(undefined, undefined, 0)).toBeUndefined()
  })
})
