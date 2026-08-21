interface RateLimitWindow {
  count: number
  windowStart: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

// Fixed-window counter on unstorage; swapping the memory driver for a shared one is a nuxt.config change, not a change here.
// Not atomic under concurrent hits on the same key — acceptable for abuse throttling, which is not a security boundary.
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
