export const APP_SETTINGS_KEYS = [
  'max_retention_days_anonymous',
  'max_retention_days_authenticated',
  'max_reads_anonymous',
  'max_reads_authenticated',
  'max_text_size_bytes',
  'max_upload_size_bytes',
  'max_total_pastes',
  'max_total_storage_bytes',
  'rate_limit_anonymous_creates_per_period',
  'rate_limit_authenticated_creates_per_period',
  'rate_limit_uploads_per_period',
  'rate_limit_period_minutes',
  'max_email_recipients_per_paste',
  'invitation_expiry_days',
  'registration_enabled',
  'public_paste_enabled',
  'require_2fa'
] as const

interface AppSettingsShape {
  max_retention_days_anonymous: number | null
  max_retention_days_authenticated: number | null
  max_reads_anonymous: number | null
  max_reads_authenticated: number | null
  max_text_size_bytes: number | null
  max_upload_size_bytes: number | null
  max_total_pastes: number | null
  max_total_storage_bytes: number | null
  rate_limit_anonymous_creates_per_period: number | null
  rate_limit_authenticated_creates_per_period: number | null
  rate_limit_uploads_per_period: number | null
  rate_limit_period_minutes: number
  max_email_recipients_per_paste: number | null
  invitation_expiry_days: number | null
  registration_enabled: boolean
  public_paste_enabled: boolean
  require_2fa: boolean
}

// Used whenever a key has no row yet in app_settings.
// A row holding null is a deliberate "unlimited", not a missing setting: return null, don't fall back here.
const APP_SETTINGS_DEFAULTS: AppSettingsShape = {
  max_retention_days_anonymous: 7,
  max_retention_days_authenticated: 30,
  max_reads_anonymous: null,
  max_reads_authenticated: null,
  max_text_size_bytes: 100_000,
  max_upload_size_bytes: 2_000_000,
  max_total_pastes: null,
  max_total_storage_bytes: 40_000_000_000,
  rate_limit_anonymous_creates_per_period: null,
  rate_limit_authenticated_creates_per_period: null,
  rate_limit_uploads_per_period: null,
  rate_limit_period_minutes: 10,
  max_email_recipients_per_paste: 3,
  invitation_expiry_days: 7,
  registration_enabled: true,
  public_paste_enabled: true,
  require_2fa: false
}

export async function getSettings<K extends keyof AppSettingsShape>(
  keys: readonly K[]
): Promise<{ [P in K]: AppSettingsShape[P] }> {
  const rows = await db
    .select({ key: schema.appSettings.key, value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(inArray(schema.appSettings.key, keys))

  const rowsByKey = new Map(rows.map(row => [row.key, row.value]))

  const result = {} as { [P in K]: AppSettingsShape[P] }
  for (const key of keys) {
    result[key] = rowsByKey.has(key) ? ((rowsByKey.get(key) ?? null) as AppSettingsShape[K]) : APP_SETTINGS_DEFAULTS[key]
  }
  return result
}

export async function getSetting<K extends keyof AppSettingsShape>(key: K): Promise<AppSettingsShape[K]> {
  const settings = await getSettings([key])
  return settings[key]
}
