interface SessionUser {
  id: string
  name: string
  email: string
  role: string
  twoFactorEnabled: boolean
}

// A shared `useState` ref rather than a `useFetch` per component: `AuthButton` sits outside `<NuxtPage>` and never remounts, so it would never learn about a sign-in that happened on a page.
// Every consumer reads this ref and calls `refreshAuthSession()` after an auth change, so they all update in lockstep.
export function useAuthUser() {
  return useState<SessionUser | null>('auth-user', () => null)
}

export async function refreshAuthSession() {
  const user = useAuthUser()
  // On SSR, $fetch doesn't forward the browser's cookies to this internal call: without them every reload looks logged-out and bounces authenticated pages back to `/`.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
  const session = await $fetch<{ user: SessionUser } | null>('/api/auth/get-session', { headers }).catch(() => null)
  user.value = session?.user ?? null
}

export async function ensureAuthSessionLoaded() {
  await callOnce('auth-session-init', refreshAuthSession)
}
