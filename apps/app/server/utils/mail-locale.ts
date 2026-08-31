import type { H3Event } from 'h3'
import { APP_LOCALES, DEFAULT_APP_LOCALE, isAppLocale, type AppLocale } from './locales'

export const MAIL_LOCALES = APP_LOCALES
export type MailLocale = AppLocale
export const DEFAULT_MAIL_LOCALE: MailLocale = DEFAULT_APP_LOCALE

// Must stay in step with `i18n.detectBrowserLanguage.cookieKey` in nuxt.config, where the switcher writes.
const LOCALE_COOKIE = 'shhh_i18n_locale'

function fromCookie(header: string | null): MailLocale | null {
  if (!header) return null

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== LOCALE_COOKIE) continue

    // The header is attacker-controlled and `decodeURIComponent` throws on malformed escapes:
    // an unusable cookie has to read as no cookie, never as a 500 on the request that sends mail.
    let value: string
    try {
      value = decodeURIComponent(part.slice(separator + 1).trim()).toLowerCase()
    } catch {
      return null
    }

    return isAppLocale(value) ? value : null
  }

  return null
}

function fromAcceptLanguage(header: string | null): MailLocale | null {
  if (!header) return null

  const ranked = header
    .split(',')
    .map((entry) => {
      const [tag, ...params] = entry.trim().split(';')
      const quality = params.find(param => param.trim().startsWith('q='))
      return { tag: (tag ?? '').trim().toLowerCase(), quality: quality ? Number(quality.split('=')[1]) : 1 }
    })
    .filter(entry => entry.tag !== '' && entry.tag !== '*' && Number.isFinite(entry.quality) && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)

  for (const { tag } of ranked) {
    // 'fr-CA' and 'fr' both mean the French mail; only the primary subtag is ours to match.
    const base = tag.split('-')[0]!
    if (isAppLocale(base)) return base
  }

  return null
}

/**
 * The cookie wins over Accept-Language: it carries a deliberate choice from the language switcher,
 * where the header is only whatever the browser was installed with.
 */
export function resolveMailLocale(headers: Headers | null | undefined): MailLocale {
  if (!headers) return DEFAULT_MAIL_LOCALE

  return fromCookie(headers.get('cookie'))
    ?? fromAcceptLanguage(headers.get('accept-language'))
    ?? DEFAULT_MAIL_LOCALE
}

export function mailLocaleFromEvent(event: H3Event): MailLocale {
  return resolveMailLocale(event.headers)
}
