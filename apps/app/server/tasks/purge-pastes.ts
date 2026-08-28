export default defineTask({
  meta: {
    name: 'purge-pastes',
    description: 'Delete expired or exhausted pastes and refresh app_stats/user_stats'
  },
  async run() {
    const { count } = await db
      .delete(schema.pastes)
      .where(isPasteReclaimable())

    await refreshStats()

    return { result: { deletedCount: count } }
  }
})
