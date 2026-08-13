export default defineTask({
  meta: {
    name: 'purge-pastes',
    description: 'Delete expired or exhausted pastes and refresh app_stats/user_stats'
  },
  async run() {
    const deleted = await db
      .delete(schema.pastes)
      .where(
        or(
          lte(schema.pastes.expiresAt, new Date()),
          and(isNotNull(schema.pastes.maxReads), gte(schema.pastes.readCount, schema.pastes.maxReads))
        )
      )
      .returning({ id: schema.pastes.id })

    await refreshStats()

    return { result: { deletedCount: deleted.length } }
  }
})
