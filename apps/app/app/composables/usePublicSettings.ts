export interface PublicSettings {
  publicPasteEnabled: boolean
  registrationEnabled: boolean
  require2fa: boolean
  mailEnabled: boolean
  maxEmailRecipients: number | null
  limits: {
    anonymous: TierLimits
    authenticated: TierLimits
  }
}

/** `null` means the instance sets no cap, which is the only case where "unlimited" may be offered. */
export interface TierLimits {
  maxRetentionDays: number | null
  maxReads: number | null
}

// Same shape as `useAuth.ts`: one shared `useState` ref so the 2FA middleware and the creation form read the same value from a single request, loaded once per app lifecycle via `callOnce`.
export function usePublicSettings() {
  return useState<PublicSettings | null>('public-settings', () => null)
}

export async function refreshPublicSettings() {
  const settings = usePublicSettings()
  // Forwards cookies on SSR like `refreshAuthSession()` does: harmless on a public endpoint, but keeps the two call sites identical.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  settings.value = await $fetch<PublicSettings>('/api/settings/public', { headers }).catch(() => null)
}

export async function ensurePublicSettingsLoaded() {
  // Resolved before the await: in a plain async function the Nuxt instance context is not restored once execution resumes, and `useState` would throw.
  const settings = usePublicSettings()
  await callOnce('public-settings-init', refreshPublicSettings)
  return settings
}
