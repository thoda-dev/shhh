<script setup lang="ts">
// Floor between two automatic checks, in case the browser's clock runs ahead of the server's.
const MIN_INTERVAL = 5 * 60 * 1000

const { t } = useI18n()
const user = useAuthUser()
const status = useUpdateStatus()

const isAdmin = computed(() => isAdminRole(user.value?.role))

let timer: ReturnType<typeof setTimeout> | undefined
let lastRequestAt = 0
// A check still in flight when the layout changes must not restart a loop next to the new banner.
let unmounted = false

// Asks again once the server's answer has expired, so a tab left open still learns about a release.
function schedule() {
  clearTimeout(timer)
  if (unmounted || !isAdmin.value) return
  const dueAt = status.value ? Date.parse(status.value.nextCheckAt) : 0
  timer = setTimeout(refresh, Math.max(dueAt, lastRequestAt + MIN_INTERVAL) - Date.now())
}

async function refresh() {
  lastRequestAt = Date.now()
  await checkForUpdates().catch(() => {})
  schedule()
}

// After mount only: no page render waits on GitHub.
onMounted(() => {
  watch(isAdmin, (admin) => {
    if (!admin) {
      status.value = null
      lastRequestAt = 0
    }
    schedule()
  }, { immediate: true })
  // A manual check from the admin menu moves the next one.
  watch(status, schedule)
})

onBeforeUnmount(() => {
  unmounted = true
  clearTimeout(timer)
})
</script>

<template>
  <!-- One id per version: dismissing it waits for the next release. Keyed too, since `UBanner` only reads the dismissal when it mounts. -->
  <UBanner
    v-if="isAdmin && status?.updateAvailable && status.latest"
    :id="`update-${status.latest.version}`"
    :key="status.latest.version"
    icon="i-lucide-sparkles"
    :title="t('updates.banner', { latest: status.latest.version, current: status.current })"
    :actions="[{ label: t('updates.releaseNotes'), to: status.latest.url, target: '_blank', trailingIcon: 'i-lucide-arrow-up-right' }]"
    close
  />
</template>
