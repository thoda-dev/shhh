// Client half of `app_settings.require_2fa`: an authenticated account that hasn't enrolled is
// pinned to /account until it does. The server half lives in `requireAdminSession` and
// `POST /api/pastes` — this middleware is the UX, not the security boundary.
const ALLOWED_ROUTE_PREFIXES = ['account', 'login', 'setup']

export default defineNuxtRouteMiddleware(async (to) => {
  await ensureAuthSessionLoaded()
  const user = useAuthUser()
  if (!user.value || user.value.twoFactorEnabled) return

  const settings = await ensurePublicSettingsLoaded()
  if (!settings.value?.require2fa) return

  // /account is where enrollment happens; /login and /setup must stay reachable regardless.
  // Matched on route name (not path) so it stays correct whatever the i18n strategy.
  const routeName = to.name?.toString() ?? ''
  if (ALLOWED_ROUTE_PREFIXES.some(prefix => routeName.startsWith(prefix))) return

  return navigateTo(useLocalePath()('/account'))
})
