import { z } from 'zod'

const querySchema = z.object({
  // Passed by the page: only it knows which locale the interface settled on.
  locale: z.enum(APP_LOCALES).default(DEFAULT_APP_LOCALE)
})

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug || !isLegalSlug(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown document' })
  }

  const { locale } = await getValidatedQuery(event, querySchema.parse)
  const document = await getLegalDocument(slug, locale)

  if (!document) {
    throw createError({ statusCode: 404, statusMessage: 'This instance publishes no such document' })
  }

  return {
    slug,
    locale: document.locale,
    updatedAt: document.updatedAt,
    // Parsed server-side: the parser config is what keeps script out, and it stays out of reach.
    document: await parseLegalMarkdown(document.content)
  }
})
