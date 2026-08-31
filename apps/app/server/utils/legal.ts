import { APP_LOCALES, DEFAULT_APP_LOCALE, type AppLocale } from './locales'
import type { LegalDurationUnit } from '../../shared/utils/legal-template'

export const LEGAL_SLUGS = ['privacy', 'terms', 'notice'] as const
export type LegalSlug = typeof LEGAL_SLUGS[number]

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value)
}

// Exact locale, then the default one, then whatever exists: the footer links a slug as soon as any language has it, so every language has to resolve to something.
export async function getLegalDocument(slug: LegalSlug, locale: AppLocale) {
  const rows = await db
    .select({
      locale: schema.legalDocuments.locale,
      content: schema.legalDocuments.content,
      updatedAt: schema.legalDocuments.updatedAt
    })
    .from(schema.legalDocuments)
    .where(eq(schema.legalDocuments.slug, slug))
    .orderBy(schema.legalDocuments.locale)

  return rows.find(row => row.locale === locale)
    ?? rows.find(row => row.locale === DEFAULT_APP_LOCALE)
    ?? rows[0]
    ?? null
}

export async function listPublishedLegalSlugs(): Promise<LegalSlug[]> {
  const rows = await db
    .selectDistinct({ slug: schema.legalDocuments.slug })
    .from(schema.legalDocuments)

  const published = new Set(rows.map(row => row.slug))
  return LEGAL_SLUGS.filter(slug => published.has(slug))
}

// Shipped with the image rather than fetched from GitHub: works offline, and always matches the version actually running.
export function getLegalTemplate(slug: LegalSlug, locale: AppLocale) {
  return useStorage('assets:server').getItem<string>(`legal/${slug}.${locale}.md`)
}

export async function listLegalTemplates() {
  const pairs = LEGAL_SLUGS.flatMap(slug => APP_LOCALES.map(locale => ({ slug, locale })))
  const present = await Promise.all(pairs.map(pair => getLegalTemplate(pair.slug, pair.locale)))

  return pairs.filter((_, index) => present[index] != null)
}

// Better Auth's own default: `auth.ts` sets no `session.expiresIn`.
const SESSION_LIFETIME_DAYS = 7

/** What the instance can answer for itself, so the fill-in form starts from the real configuration rather than from a round number. The audit log is absent on purpose: nothing purges it. */
export async function suggestedLegalDurations() {
  const settings = await getSettings(['max_retention_days_anonymous', 'max_retention_days_authenticated'])

  const suggestions: Record<string, { amount: number, unit: LegalDurationUnit }> = {
    SESSION_RETENTION: { amount: SESSION_LIFETIME_DAYS, unit: 'days' }
  }

  const { max_retention_days_anonymous: anonymous, max_retention_days_authenticated: authenticated } = settings
  // Either tier left uncapped means there is no maximum to state.
  if (anonymous !== null && authenticated !== null) {
    suggestions.RETENTION_MAX = { amount: Math.max(anonymous, authenticated), unit: 'days' }
  }

  const banHours = autoBanDurationHours()
  if (banHours !== null) {
    suggestions.BAN_DURATION = { amount: banHours, unit: 'hours' }
  }

  return suggestions
}
