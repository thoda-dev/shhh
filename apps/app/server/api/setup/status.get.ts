export default defineEventHandler(async () => {
  return { completed: await isSetupComplete() }
})
