export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  return getSettings(APP_SETTINGS_KEYS)
})
