import { describe, expect, it } from 'vitest'
import { resolveMailLocale } from '../server/utils/mail-locale'

function headers(entries: Record<string, string>) {
  return new Headers(entries)
}

describe('resolveMailLocale', () => {
  it('falls back to English without headers', () => {
    expect(resolveMailLocale(undefined)).toBe('en')
    expect(resolveMailLocale(null)).toBe('en')
    expect(resolveMailLocale(headers({}))).toBe('en')
  })

  it('reads the locale the language switcher stored', () => {
    expect(resolveMailLocale(headers({ cookie: 'shhh_i18n_locale=fr' }))).toBe('fr')
  })

  it('finds the cookie among others', () => {
    expect(resolveMailLocale(headers({ cookie: 'foo=bar; shhh_i18n_locale=fr; baz=qux' }))).toBe('fr')
  })

  it('is not fooled by a cookie whose name merely ends the same way', () => {
    expect(resolveMailLocale(headers({ cookie: 'not_shhh_i18n_locale=fr' }))).toBe('en')
  })

  it('prefers the cookie over Accept-Language, since it is a deliberate choice', () => {
    const source = headers({ 'cookie': 'shhh_i18n_locale=en', 'accept-language': 'fr-FR,fr;q=0.9' })
    expect(resolveMailLocale(source)).toBe('en')
  })

  it('falls back to Accept-Language when no cookie was set', () => {
    expect(resolveMailLocale(headers({ 'accept-language': 'fr-FR,fr;q=0.9,en;q=0.8' }))).toBe('fr')
  })

  it('honours the quality ranking rather than the written order', () => {
    expect(resolveMailLocale(headers({ 'accept-language': 'fr;q=0.3,en;q=0.9' }))).toBe('en')
    expect(resolveMailLocale(headers({ 'accept-language': 'en;q=0.3,fr;q=0.9' }))).toBe('fr')
  })

  it('ignores a language that is refused outright', () => {
    expect(resolveMailLocale(headers({ 'accept-language': 'fr;q=0' }))).toBe('en')
  })

  it('skips unsupported languages instead of failing', () => {
    expect(resolveMailLocale(headers({ 'accept-language': 'de-DE,es;q=0.8' }))).toBe('en')
    expect(resolveMailLocale(headers({ 'accept-language': 'de-DE,fr;q=0.8' }))).toBe('fr')
  })

  it('ignores an unsupported or malformed cookie value and moves on', () => {
    expect(resolveMailLocale(headers({ cookie: 'shhh_i18n_locale=de' }))).toBe('en')
    expect(resolveMailLocale(headers({ cookie: 'shhh_i18n_locale=' }))).toBe('en')
  })
})
