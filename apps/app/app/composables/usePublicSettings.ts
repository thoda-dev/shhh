export interface PublicSettings {
  publicPasteEnabled: boolean
  registrationEnabled: boolean
  require2fa: boolean
  mailEnabled: boolean
  maxEmailRecipients: number | null
}

// Same shape as `useAuth.ts`: one shared `useState` ref rather than a `useFetch` per component,
// so the global 2FA middleware, the creation form and any future sign-up page all read the same
// value and a single request covers them all. Loaded once per app lifecycle via `callOnce`.
export function usePublicSettings() {
  return useState<PublicSettings | null>('public-settings', () => null)
}

export async function refreshPublicSettings() {
  const settings = usePublicSettings()
  // On SSR, forward the browser's cookies the same way `refreshAuthSession()` does — harmless here
  // (the endpoint is public) but keeps the two call sites behaving identically.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  settings.value = await $fetch<PublicSettings>('/api/settings/public', { headers }).catch(() => null)
}

export async function ensurePublicSettingsLoaded() {
  // Resolved before the await, not after: inside a plain async function (unlike a component's
  // `<script setup>`) the Nuxt instance context is not restored once execution resumes, and
  // `useState` would throw. Same reason `refreshPublicSettings` calls its composables up front.
  const settings = usePublicSettings()
  await callOnce('public-settings-init', refreshPublicSettings)
  return settings
}
