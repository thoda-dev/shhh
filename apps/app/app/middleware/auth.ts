// Opted into per page. The server checks every request on its own; this only keeps a page from rendering for someone it would refuse.
export default defineNuxtRouteMiddleware(async (to) => {
  await ensureAuthSessionLoaded()
  const user = useAuthUser()
  const localePath = useLocalePath()

  if (!user.value) return navigateTo(localePath('/login'))

  const allowed = to.meta.role === 'super_admin'
    ? user.value.role === 'super_admin'
    : to.meta.role === 'admin' ? isAdminRole(user.value.role) : true
  if (!allowed) return navigateTo(localePath('/dashboard'))
})
