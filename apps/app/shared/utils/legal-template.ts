const PLACEHOLDER = /\{\{([A-Z0-9_]+)\}\}/g

// A list marker or quote sign, kept aside so cleaning a line never eats its bullet.
const LINE_PREFIX = /^(\s*(?:[-*+]\s+|\d+\.\s+|>\s*)?)/
const EDGE_SEPARATORS = /^[\s·|,;:—–-]+|[\s·|,;:—–-]+$/g
const EMPTY_EMPHASIS = /\*\*\s*\*\*|__\s*__/g

/** The placeholders a template contains, in the order they first appear. */
export function extractLegalPlaceholders(template: string): string[] {
  return [...new Set(Array.from(template.matchAll(PLACEHOLDER), match => match[1]!))]
}

/** A blank value keeps its `{{PLACEHOLDER}}`, so a half-filled template still says what is missing. A removed one takes its line with it, unless another placeholder or filled value is left on it. */
export function fillLegalTemplate(
  template: string,
  values: Record<string, string>,
  removed: string[] = []
): string {
  const drop = new Set(removed)

  const lines = template.split('\n').flatMap((line) => {
    let touched = false
    let survivors = 0

    const filled = line.replace(PLACEHOLDER, (token, key: string) => {
      if (drop.has(key)) {
        touched = true
        return ''
      }
      survivors++
      return values[key]?.trim() || token
    })

    if (!touched) return [filled]
    if (survivors === 0) return []

    const prefix = filled.match(LINE_PREFIX)?.[1] ?? ''
    const rest = filled
      .slice(prefix.length)
      .replace(EMPTY_EMPHASIS, '')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(EDGE_SEPARATORS, '')

    return [prefix + rest]
  })

  return lines.join('\n').replace(/\n{3,}/g, '\n\n')
}

/** Shown as the field's placeholder in the fill-in form. Fixed data, not translated: an address or a phone number reads the same in every language. Durations and wording have none — their label and their unit say enough. */
export const LEGAL_PLACEHOLDER_EXAMPLES: Record<string, string> = {
  DATE: '2026-08-31',
  OPERATOR: 'Acme SAS',
  CONTACT_EMAIL: 'privacy@example.com',
  PHONE: '+33 1 23 45 67 89',
  POSTAL_ADDRESS: '1 rue Example\n75000 Paris',
  LEGAL_FORM_AND_REGISTRATION: 'SAS — RCS Paris 000 000 000',
  PUBLICATION_DIRECTOR: 'Camille Martin',
  HOSTING_PROVIDER: 'Hetzner Online GmbH',
  HOSTING_ADDRESS: 'Industriestr. 25, 91710 Gunzenhausen',
  HOSTING_CONTACT: '+49 9831 505-0',
  MAIL_PROVIDER: 'Resend',
  SUPERVISORY_AUTHORITY: 'CNIL',
  INSTANCE_URL: 'https://shhh.example.com',
  MINIMUM_AGE: '15'
}

/**
 * How a field behaves when several languages are filled at once.
 *
 * - `data` — the same string everywhere: a name, an address, a phone number.
 * - `wording` — a sentence, so one field per language.
 * - `duration` — a number and a unit, the unit written in each language's own words.
 * - `date` — filled from today, formatted per language.
 *
 * Anything not listed is `data`, which is the safe default: one field, inserted verbatim.
 */
export type LegalFieldKind = 'data' | 'wording' | 'duration' | 'date'

const FIELD_KINDS: Record<string, LegalFieldKind> = {
  DATE: 'date',
  RETENTION_MAX: 'duration',
  SESSION_RETENTION: 'duration',
  BAN_DURATION: 'duration',
  AUDIT_RETENTION: 'duration',
  JURISDICTION: 'wording',
  SUPERVISORY_AUTHORITY: 'wording',
  CHANGE_NOTICE: 'wording',
  GOVERNING_LAW: 'wording',
  COURTS: 'wording'
}

export const LEGAL_DURATION_UNITS = ['hours', 'days', 'months', 'years'] as const
export type LegalDurationUnit = typeof LEGAL_DURATION_UNITS[number]

export function legalFieldKind(key: string): LegalFieldKind {
  return FIELD_KINDS[key] ?? 'data'
}

/** A number input hands back a number, an empty one hands back a string or nothing at all, so the amount is normalised here rather than trusted. `null` means the field is not filled in. */
export function parseDurationAmount(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(amount) && amount > 0 ? amount : null
}
