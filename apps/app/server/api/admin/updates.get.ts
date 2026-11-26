import { z } from 'zod'

const querySchema = z.object({ refresh: z.literal('1').optional() })

// Server-side: the CSP keeps the browser away from GitHub.
export default defineEventHandler(async (event) => {
  await requireAdminSession(event)
  const { refresh } = await getValidatedQuery(event, querySchema.parse)
  return getUpdateStatus(useRuntimeConfig().public.appVersion, { force: refresh === '1' })
})
