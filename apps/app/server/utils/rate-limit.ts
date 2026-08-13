interface RateLimitWindow {
  count: number
  windowStart: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

// Fixed-window counter backed by unstorage (memory driver for now — swappable later via
// nitro.storage.ratelimit in nuxt.config.ts without touching this logic, e.g. for multi-instance
// deployments). Not perfectly atomic under concurrent hits on the exact same key, which is an
// acceptable tradeoff for abuse throttling (unlike the paste read-counter, not a security boundary).
export async function checkRateLimit(params: {
  scope: 'ip' | 'user'
  identifier: string
  kind: string
  limit: number | null
  periodMinutes: number
}): Promise<RateLimitResult> {
  if (params.limit === null) {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY, resetAt: 0 }
  }

  const storage = useStorage('ratelimit')
  const key = `${params.scope}:${params.kind}:${params.identifier}`
  const windowMs = params.periodMinutes * 60 * 1000
  const now = Date.now()

  const entry = await storage.getItem<RateLimitWindow>(key)

  if (!entry || now - entry.windowStart >= windowMs) {
    await storage.setItem<RateLimitWindow>(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: params.limit - 1, resetAt: now + windowMs }
  }

  if (entry.count >= params.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.windowStart + windowMs }
  }

  await storage.setItem<RateLimitWindow>(key, { count: entry.count + 1, windowStart: entry.windowStart })
  return { allowed: true, remaining: params.limit - entry.count - 1, resetAt: entry.windowStart + windowMs }
}
