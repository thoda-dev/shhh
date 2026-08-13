export default defineNuxtRouteMiddleware(async (to) => {
  const { completed } = await $fetch('/api/setup/status')
  const isSetupRoute = to.name?.toString().startsWith('setup')

  if (!completed && !isSetupRoute) {
    const localePath = useLocalePath()
    return navigateTo(localePath('/setup'))
  }

  if (completed && isSetupRoute) {
    const localePath = useLocalePath()
    return navigateTo(localePath('/'))
  }
})
