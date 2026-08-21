import { getBotDetection } from '#robots/server/composables/getBotDetection'

// Common scanner-bait paths automated probes request on almost any public web server.
const FORBIDDEN_ROUTES = [
  '.git',
  '.env',
  'autodiscover/autodiscover.json',
  'wlwmanifest.xml',
  'wp-admin',
  'wp-login.php',
  'xmlrpc.php',
  'dump.sql',
  'config.php',
  'phpmyadmin',
  'info_php.php',
  'php-info.php',
  'infophp.php',
  'phpinfo.php'
]

// Exact loopback addresses only, never a blanket `::ffff:` prefix match: that prefix means "IPv4-mapped IPv6" and covers every real client behind most proxies, which would bypass this middleware for everyone.
const IGNORED_IPS = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1'])

const PUBLIC_PATHS = new Set([
  '/',
  // Monitoring probes send their own User-Agent and would be classified as untrusted bots, which bans the monitor's IP outright.
  '/api/health',
  '/robots.txt',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/site.webmanifest',
  '/safari-pinned-tab.svg'
])

const PUBLIC_PATH_PREFIXES = ['/_nuxt/']

export default defineEventHandler(async (event) => {
  const path = event.path

  if (PUBLIC_PATHS.has(path) || PUBLIC_PATH_PREFIXES.some(prefix => path.startsWith(prefix))) {
    return
  }

  const ip = getRequestIP(event, { xForwardedFor: true })
  if (!ip || IGNORED_IPS.has(ip)) {
    return
  }

  if (await isIpAllowlisted(ip)) {
    return
  }

  const detection = getBotDetection(event)
  const untrustedBot = detection.isBot && !detection.trusted
  const forbiddenRoute = FORBIDDEN_ROUTES.some(route => path.includes(route))

  if (!forbiddenRoute && !untrustedBot && !(await isIpBanned(ip))) {
    return
  }

  if (forbiddenRoute || untrustedBot) {
    await banIp(ip, forbiddenRoute ? 'forbidden_route_probe' : `bot:${detection.botName ?? 'unknown'}`)
  }

  throw createError({ statusCode: 403, statusMessage: 'Access denied' })
})
