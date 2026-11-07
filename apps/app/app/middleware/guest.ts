// For the sign-in and sign-up pages: an open session has nothing to do there.
export default defineNuxtRouteMiddleware(async () => {
  await ensureAuthSessionLoaded()
  if (useAuthUser().value) return navigateTo(useLocalePath()('/dashboard'))
})
