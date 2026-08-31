export default defineEventHandler(async (event) => {
  await requireSuperAdminSession(event)

  const documents = await db
    .select({
      slug: schema.legalDocuments.slug,
      locale: schema.legalDocuments.locale,
      content: schema.legalDocuments.content,
      updatedAt: schema.legalDocuments.updatedAt
    })
    .from(schema.legalDocuments)

  return {
    documents,
    templates: await listLegalTemplates(),
    durations: await suggestedLegalDurations()
  }
})
