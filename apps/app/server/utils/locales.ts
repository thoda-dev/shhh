// Must stay in step with `i18n.locales` in nuxt.config.
export const APP_LOCALES = ['en', 'fr'] as const
export type AppLocale = typeof APP_LOCALES[number]
export const DEFAULT_APP_LOCALE: AppLocale = 'en'

export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value)
}
