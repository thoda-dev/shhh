import { z } from 'zod'

const querySchema = z.object({
  slug: z.enum(LEGAL_SLUGS),
  locale: z.enum(APP_LOCALES)
})

export default defineEventHandler(async (event) => {
  await requireSuperAdminSession(event)

  const { slug, locale } = await getValidatedQuery(event, querySchema.parse)
  const content = await getLegalTemplate(slug, locale)

  if (!content) {
    throw createError({ statusCode: 404, statusMessage: 'No template ships for this document' })
  }

  return { slug, locale, content }
})
