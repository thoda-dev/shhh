function fetchUpdateStatus(force: boolean) {
  return $fetch('/api/admin/updates', { query: force ? { refresh: '1' } : undefined })
}

type UpdateStatus = Awaited<ReturnType<typeof fetchUpdateStatus>>

// Shared by the banner and the admin menu link.
export function useUpdateStatus() {
  return useState<UpdateStatus | null>('update-status', () => null)
}

export async function checkForUpdates({ force = false } = {}) {
  const status = useUpdateStatus()
  status.value = await fetchUpdateStatus(force)
  return status.value
}
