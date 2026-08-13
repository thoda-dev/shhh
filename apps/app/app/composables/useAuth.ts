interface SessionUser {
  id: string
  name: string
  email: string
  role: string
  twoFactorEnabled: boolean
}

// A shared `useState` ref, not independent `useFetch` calls per component — `AuthButton` lives
// outside `<NuxtPage>` (app.vue) and never remounts on navigation, so it wouldn't otherwise learn
// about a sign-in/sign-out that happened on a page. Every consumer reads this same ref and calls
// `refreshAuthSession()` after any auth change so all of them update in lockstep, no reload needed.
export function useAuthUser() {
  return useState<SessionUser | null>('auth-user', () => null)
}

export async function refreshAuthSession() {
  const user = useAuthUser()
  // On SSR (full page reload), $fetch doesn't automatically forward the browser's cookies to
  // this internal call — without this, the server never sees the session cookie and every reload
  // looks logged-out, bouncing authenticated pages back to `/`.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  const session = await $fetch<{ user: SessionUser } | null>('/api/auth/get-session', { headers }).catch(() => null)
  user.value = session?.user ?? null
}

export async function ensureAuthSessionLoaded() {
  await callOnce('auth-session-init', refreshAuthSession)
}
