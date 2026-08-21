import type { H3Event } from 'h3'

/**
 * How many proxies you control sit between the internet and this app. 0 — the default — never reads
 * X-Forwarded-For and uses the socket address, which is the only value a client cannot influence.
 *
 * Anything above 0 is a promise about your deployment, so it is opt-in: the danger is not reading the
 * header, it is reading it when nothing trustworthy wrote it.
 */
function trustedProxyDepth(): number {
  const raw = process.env.TRUSTED_PROXY_DEPTH
  if (!raw) return 0
  const depth = Number(raw)
  return Number.isInteger(depth) && depth >= 0 ? depth : 0
}

/**
 * Resolves the client address from the socket address and the X-Forwarded-For chain.
 *
 * Each proxy appends the peer it received the request from, so the chain reads left to right from
 * least to most trustworthy: the leftmost entries may have been forged by the client, the rightmost
 * were written by the hop closest to us. Counting `depth` entries from the right therefore lands on
 * the address our own infrastructure observed, and anything a client prepended is ignored.
 *
 * A chain shorter than `depth` means the request did not come through the expected proxies at all —
 * a direct hit, or a misconfiguration. Falling back to the socket address is the safe reading; using
 * whatever is there would accept a forged header from a client that bypassed the proxy.
 */
export function resolveClientIp(socketIp: string | undefined, forwardedFor: string | undefined, depth: number): string | undefined {
  if (depth <= 0 || !forwardedFor) return socketIp

  const chain = forwardedFor.split(',').map(part => part.trim()).filter(Boolean)
  if (chain.length < depth) return socketIp

  return chain[chain.length - depth] ?? socketIp
}

/**
 * The address every abuse control in this app is keyed on: the rate limiter, the allowlist, the
 * blocklist, and the automatic bans. Always go through this rather than `getRequestIP`, whose
 * `xForwardedFor` option takes the leftmost entry — the one a client can write.
 */
export function getClientIp(event: H3Event): string | undefined {
  return resolveClientIp(
    event.node.req.socket.remoteAddress,
    getRequestHeader(event, 'x-forwarded-for'),
    trustedProxyDepth()
  )
}
