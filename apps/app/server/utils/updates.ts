// `/latest` skips drafts and prereleases, so only a published stable release can be announced.
const LATEST_RELEASE_URL = 'https://api.github.com/repos/thoda-dev/shhh/releases/latest'
const RELEASE_PAGE_PREFIX = 'https://github.com/thoda-dev/shhh/releases/'

const HOUR = 60 * 60 * 1000
// Failures are cached too, so an instance without outbound access doesn't wait on every page.
const SUCCESS_TTL = 6 * HOUR
const FAILURE_TTL = HOUR
// Keeps the manual check within GitHub's 60 anonymous requests an hour.
const FORCED_MIN_AGE = 60 * 1000
const REQUEST_TIMEOUT = 5000

export interface LatestRelease {
  version: string
  url: string
}

interface CachedCheck {
  latest: LatestRelease | null
  checkedAt: number
}

let cached: CachedCheck | null = null
let pending: Promise<CachedCheck> | null = null

// The same pattern as `scripts/release.mjs`, so the running version may be a prerelease or carry build metadata.
function parseVersion(version: string) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version.trim())
  return match ? { core: match.slice(1, 4).map(Number), prerelease: match[4] !== undefined } : null
}

// Only a stable release is ever offered, so two prereleases never need comparing.
export function isNewerVersion(candidate: string, current: string) {
  const a = parseVersion(candidate)
  const b = parseVersion(current)
  if (!a || a.prerelease || !b) return false
  const index = a.core.findIndex((part, i) => part !== b.core[i])
  // Same core: 1.4.0 comes after 1.4.0-rc.1, and build metadata never counts.
  if (index === -1) return b.prerelease
  return a.core[index]! > b.core[index]!
}

async function fetchLatestRelease(currentVersion: string): Promise<LatestRelease | null> {
  try {
    const response = await fetch(LATEST_RELEASE_URL, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': `shhh/${currentVersion}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    })
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`)

    const body = await response.json() as { tag_name?: unknown, html_url?: unknown }
    const tag = typeof body.tag_name === 'string' ? body.tag_name : ''
    const url = typeof body.html_url === 'string' ? body.html_url : ''
    // The link is shown to admins, so it must point at this repository.
    const parsed = parseVersion(tag)
    if (!parsed || parsed.prerelease || !url.startsWith(RELEASE_PAGE_PREFIX)) throw new Error('unexpected release payload')

    return { version: tag.replace(/^v/, ''), url }
  } catch (error) {
    console.error('[updates] latest release lookup failed:', error instanceof Error ? error.message : error)
    return null
  }
}

function ttl(check: CachedCheck) {
  return check.latest ? SUCCESS_TTL : FAILURE_TTL
}

export async function getUpdateStatus(currentVersion: string, { force = false } = {}) {
  const age = cached ? Date.now() - cached.checkedAt : Infinity
  const maxAge = force ? FORCED_MIN_AGE : cached ? ttl(cached) : 0

  if (age >= maxAge) {
    // Concurrent callers share one request.
    pending ??= fetchLatestRelease(currentVersion)
      .then(latest => ({ latest, checkedAt: Date.now() }))
      .finally(() => {
        pending = null
      })
    cached = await pending
  }

  const { latest, checkedAt } = cached!
  return {
    current: currentVersion,
    latest,
    updateAvailable: latest !== null && isNewerVersion(latest.version, currentVersion),
    checkedAt: new Date(checkedAt).toISOString(),
    // When asking again can bring a different answer.
    nextCheckAt: new Date(checkedAt + ttl(cached!)).toISOString()
  }
}
