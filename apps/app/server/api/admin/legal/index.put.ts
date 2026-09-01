import { z } from 'zod'

const documentSchema = z.object({
  slug: z.enum(LEGAL_SLUGS),
  locale: z.enum(APP_LOCALES),
  // Blank means absent: the row goes, and the footer link with it.
  content: z.string().max(200_000)
})

export default defineEventHandler(async (event) => {
  const session = await requireSuperAdminSession(event)
  const body = await readValidatedBody(event, documentSchema.parse)
  const content = body.content.trim()

  if (!content) {
    await db
      .delete(schema.legalDocuments)
      .where(and(eq(schema.legalDocuments.slug, body.slug), eq(schema.legalDocuments.locale, body.locale)))

    await db.insert(schema.adminAuditLog).values({
      actorId: session.user.id,
      action: 'legal_document.delete',
      targetId: `${body.slug}:${body.locale}`
    })

    return { slug: body.slug, locale: body.locale, content: '', updatedAt: null }
  }

  // Fails here rather than on the public page.
  await parseDocumentMarkdown(content)

  const [document] = await db
    .insert(schema.legalDocuments)
    .values({ slug: body.slug, locale: body.locale, content, updatedBy: session.user.id })
    .onConflictDoUpdate({
      target: [schema.legalDocuments.slug, schema.legalDocuments.locale],
      set: { content, updatedAt: new Date(), updatedBy: session.user.id }
    })
    .returning({
      slug: schema.legalDocuments.slug,
      locale: schema.legalDocuments.locale,
      content: schema.legalDocuments.content,
      updatedAt: schema.legalDocuments.updatedAt
    })

  await db.insert(schema.adminAuditLog).values({
    actorId: session.user.id,
    action: 'legal_document.update',
    targetId: `${body.slug}:${body.locale}`,
    details: { length: content.length }
  })

  return document
})
