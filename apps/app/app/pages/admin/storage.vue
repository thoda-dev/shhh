<script setup lang="ts">
interface StorageReport {
  generatedAt: string
  quotas: {
    max_total_pastes: number | null
    max_total_storage_bytes: number | null
    max_text_size_bytes: number | null
    max_upload_size_bytes: number | null
  }
  pastes: {
    total: number
    anonymous: number
    authenticated: number
    text: number
    file: number
    reclaimable: number
  }
  bytes: {
    total: number
    anonymous: number
    authenticated: number
    text: number
    file: number
    reclaimable: number
  }
  largest: { text: number, file: number }
  topOwners: { id: string, name: string, email: string, pastes: number, bytes: number }[]
  database: { totalBytes: number, pastesTableBytes: number } | null
}

interface Bar {
  key: string
  label: string
  hint?: string
  value: string
  limit: string | null
  percent: number | null
  color: 'primary' | 'warning' | 'error' | 'neutral'
}

const { t, locale } = useI18n()
const localePath = useLocalePath()

await ensureAuthSessionLoaded()
const user = useAuthUser()
if (user.value?.role !== 'super_admin') {
  await navigateTo(localePath('/'))
}

const { data: report, refresh, status, error } = await useFetch<StorageReport>('/api/admin/storage')

const errorMessage = computed(() => {
  if (!error.value) return ''
  const { statusMessage, message } = fetchErrorMessages(error.value)
  return statusMessage || message || t('admin.storage.errors.generic')
})

// `status` flips back to 'pending' on every refresh, which would swap the whole report for a spinner.
const refreshing = ref(false)
async function reload() {
  refreshing.value = true
  try {
    await refresh()
  } finally {
    refreshing.value = false
  }
}

function percentOf(used: number, limit: number | null) {
  if (limit === null || limit <= 0) return null
  return Math.min(100, (used / limit) * 100)
}

// Same thresholds as the badge colours elsewhere: amber is "plan for it", red is "act on it".
function quotaColor(percent: number | null): Bar['color'] {
  if (percent === null) return 'neutral'
  if (percent >= 90) return 'error'
  if (percent >= 75) return 'warning'
  return 'primary'
}

function quotaBar(key: string, label: string, used: number, limit: number | null, format: (value: number) => string): Bar {
  const percent = percentOf(used, limit)
  return {
    key,
    label,
    value: format(used),
    limit: limit === null ? null : format(limit),
    percent,
    color: quotaColor(percent)
  }
}

function shareBar(key: string, label: string, used: number, hint: string, color: Bar['color'] = 'neutral'): Bar {
  return {
    key,
    label,
    hint,
    value: formatBytes(used),
    limit: null,
    percent: percentOf(used, report.value?.bytes.total ?? 0) ?? 0,
    color
  }
}

const quotaBars = computed<Bar[]>(() => {
  if (!report.value) return []
  const { bytes, pastes, quotas } = report.value
  return [
    quotaBar('storage', t('admin.storage.storageUsed'), bytes.total, quotas.max_total_storage_bytes, formatBytes),
    quotaBar('pastes', t('admin.storage.pastesStored'), pastes.total, quotas.max_total_pastes, value => String(value))
  ]
})

const compositionBars = computed<Bar[]>(() => {
  if (!report.value) return []
  const { bytes, pastes } = report.value
  return [
    shareBar('text', t('admin.storage.textPastes'), bytes.text, t('admin.storage.pastesCount', { count: pastes.text }), 'primary'),
    shareBar('file', t('admin.storage.filePastes'), bytes.file, t('admin.storage.pastesCount', { count: pastes.file }), 'primary'),
    shareBar('anonymous', t('admin.storage.anonymousPastes'), bytes.anonymous, t('admin.storage.pastesCount', { count: pastes.anonymous })),
    shareBar('authenticated', t('admin.storage.authenticatedPastes'), bytes.authenticated, t('admin.storage.pastesCount', { count: pastes.authenticated }))
  ]
})

const reclaimableBar = computed<Bar | null>(() => {
  if (!report.value) return null
  const { bytes, pastes } = report.value
  return shareBar('reclaimable', t('admin.storage.reclaimable'), bytes.reclaimable, t('admin.storage.pastesCount', { count: pastes.reclaimable }), 'warning')
})

const ceilingBars = computed<Bar[]>(() => {
  if (!report.value) return []
  const { largest, quotas } = report.value
  return [
    quotaBar('largest-text', t('admin.storage.largestText'), largest.text, quotas.max_text_size_bytes, formatBytes),
    quotaBar('largest-file', t('admin.storage.largestFile'), largest.file, quotas.max_upload_size_bytes, formatBytes)
  ]
})

const ownerBars = computed<Bar[]>(() => {
  if (!report.value) return []
  return report.value.topOwners.map(owner => shareBar(
    owner.id,
    owner.name || owner.email,
    owner.bytes,
    t('admin.storage.pastesCount', { count: owner.pastes }),
    'primary'
  ))
})

const purgeOpen = ref(false)
const purging = ref(false)
const purgedCount = ref<number | null>(null)
const purgeError = ref('')

async function purge() {
  purging.value = true
  purgeError.value = ''
  try {
    const { deletedCount } = await $fetch<{ deletedCount: number }>('/api/admin/pastes/purge', { method: 'POST' })
    purgedCount.value = deletedCount
    await refresh()
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    purgeError.value = statusMessage || message || t('admin.storage.errors.purge')
  } finally {
    purging.value = false
    // Closed on failure too: the alert renders in the card, which the overlay would hide.
    purgeOpen.value = false
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value)
}
</script>

<template>
  <div class="mx-auto max-w-5xl p-4">
    <div class="mb-2 flex items-center justify-between">
      <h1 class="text-xl font-semibold">
        {{ t('admin.storage.title') }}
      </h1>
      <UButton
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="t('dashboard.backToCreate')"
        :to="localePath('/')"
      />
    </div>
    <AdminNav />

    <p class="mb-6 text-sm text-muted">
      {{ t('admin.storage.description') }}
    </p>

    <div
      v-if="status === 'pending' && !report"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-6 animate-spin"
      />
    </div>

    <div
      v-else-if="report"
      class="space-y-6"
    >
      <UCard>
        <div class="mb-4 flex items-center justify-between gap-4">
          <h2 class="text-sm font-medium">
            {{ t('admin.storage.quotasSection') }}
          </h2>
          <UButton
            variant="ghost"
            size="xs"
            icon="i-lucide-refresh-cw"
            :label="t('admin.storage.refresh')"
            :loading="refreshing"
            @click="reload"
          />
        </div>
        <div class="space-y-5">
          <div
            v-for="bar in quotaBars"
            :key="bar.key"
            class="space-y-1.5"
          >
            <div class="flex items-baseline justify-between gap-4 text-sm">
              <span>{{ bar.label }}</span>
              <span class="tabular-nums text-muted">{{ bar.value }}<span v-if="bar.limit"> / {{ bar.limit }}</span></span>
            </div>
            <UProgress
              v-if="bar.percent !== null"
              :model-value="bar.percent"
              :max="100"
              :color="bar.color"
              size="sm"
            />
            <UBadge
              v-else
              variant="subtle"
              color="neutral"
              size="sm"
            >
              {{ t('admin.storage.noQuota') }}
            </UBadge>
            <p
              v-if="bar.percent !== null"
              class="text-xs text-muted"
            >
              {{ t('admin.storage.percentUsed', { percent: bar.percent.toFixed(1) }) }}
            </p>
          </div>
        </div>
      </UCard>

      <UCard>
        <h2 class="mb-1 text-sm font-medium">
          {{ t('admin.storage.compositionSection') }}
        </h2>
        <p class="mb-4 text-xs text-muted">
          {{ t('admin.storage.compositionHint', { total: formatBytes(report.bytes.total) }) }}
        </p>
        <div class="space-y-4">
          <div
            v-for="bar in compositionBars"
            :key="bar.key"
            class="space-y-1.5"
          >
            <div class="flex items-baseline justify-between gap-4 text-sm">
              <span>{{ bar.label }} <span class="text-xs text-muted">· {{ bar.hint }}</span></span>
              <span class="tabular-nums text-muted">{{ bar.value }}</span>
            </div>
            <UProgress
              :model-value="bar.percent ?? 0"
              :max="100"
              :color="bar.color"
              size="sm"
            />
          </div>
        </div>
      </UCard>

      <UCard v-if="reclaimableBar">
        <div class="mb-1 flex items-center justify-between gap-4">
          <h2 class="text-sm font-medium">
            {{ t('admin.storage.reclaimableSection') }}
          </h2>
          <UButton
            color="error"
            variant="subtle"
            size="xs"
            icon="i-lucide-trash-2"
            :label="t('admin.storage.purge')"
            :disabled="report.pastes.reclaimable === 0"
            @click="purgeOpen = true"
          />
        </div>
        <p class="mb-4 text-xs text-muted">
          {{ t('admin.storage.reclaimableHint') }}
        </p>
        <UAlert
          v-if="purgeError"
          color="error"
          variant="subtle"
          :title="purgeError"
          class="mb-4"
        />
        <UAlert
          v-else-if="purgedCount !== null"
          color="success"
          variant="subtle"
          :title="t('admin.storage.purged', { count: purgedCount })"
          class="mb-4"
        />
        <div class="space-y-1.5">
          <div class="flex items-baseline justify-between gap-4 text-sm">
            <span>{{ reclaimableBar.label }} <span class="text-xs text-muted">· {{ reclaimableBar.hint }}</span></span>
            <span class="tabular-nums text-muted">{{ reclaimableBar.value }}</span>
          </div>
          <UProgress
            :model-value="reclaimableBar.percent ?? 0"
            :max="100"
            :color="reclaimableBar.color"
            size="sm"
          />
        </div>
      </UCard>

      <UCard>
        <h2 class="mb-1 text-sm font-medium">
          {{ t('admin.storage.ceilingsSection') }}
        </h2>
        <p class="mb-4 text-xs text-muted">
          {{ t('admin.storage.ceilingsHint') }}
        </p>
        <div class="space-y-5">
          <div
            v-for="bar in ceilingBars"
            :key="bar.key"
            class="space-y-1.5"
          >
            <div class="flex items-baseline justify-between gap-4 text-sm">
              <span>{{ bar.label }}</span>
              <span class="tabular-nums text-muted">{{ bar.value }}<span v-if="bar.limit"> / {{ bar.limit }}</span></span>
            </div>
            <UProgress
              v-if="bar.percent !== null"
              :model-value="bar.percent"
              :max="100"
              :color="bar.color"
              size="sm"
            />
            <UBadge
              v-else
              variant="subtle"
              color="neutral"
              size="sm"
            >
              {{ t('admin.storage.noQuota') }}
            </UBadge>
          </div>
        </div>
      </UCard>

      <UCard>
        <h2 class="mb-4 text-sm font-medium">
          {{ t('admin.storage.topOwnersSection') }}
        </h2>
        <p
          v-if="!ownerBars.length"
          class="text-sm text-muted"
        >
          {{ t('admin.storage.topOwnersEmpty') }}
        </p>
        <div
          v-else
          class="space-y-4"
        >
          <div
            v-for="bar in ownerBars"
            :key="bar.key"
            class="space-y-1.5"
          >
            <div class="flex items-baseline justify-between gap-4 text-sm">
              <span class="truncate">{{ bar.label }} <span class="text-xs text-muted">· {{ bar.hint }}</span></span>
              <span class="shrink-0 tabular-nums text-muted">{{ bar.value }}</span>
            </div>
            <UProgress
              :model-value="bar.percent ?? 0"
              :max="100"
              :color="bar.color"
              size="sm"
            />
          </div>
        </div>
      </UCard>

      <UCard>
        <h2 class="mb-1 text-sm font-medium">
          {{ t('admin.storage.databaseSection') }}
        </h2>
        <p class="mb-4 text-xs text-muted">
          {{ t('admin.storage.databaseHint') }}
        </p>
        <div
          v-if="report.database"
          class="space-y-2 text-sm"
        >
          <div class="flex items-baseline justify-between gap-4">
            <span>{{ t('admin.storage.databaseTotal') }}</span>
            <span class="tabular-nums text-muted">{{ formatBytes(report.database.totalBytes) }}</span>
          </div>
          <div class="flex items-baseline justify-between gap-4">
            <span>{{ t('admin.storage.databasePastesTable') }}</span>
            <span class="tabular-nums text-muted">{{ formatBytes(report.database.pastesTableBytes) }}</span>
          </div>
        </div>
        <p
          v-else
          class="text-sm text-muted"
        >
          {{ t('admin.storage.databaseUnavailable') }}
        </p>
      </UCard>

      <p class="text-center text-xs text-muted">
        {{ t('admin.storage.generatedAt', { date: formatDate(report.generatedAt) }) }}
      </p>
    </div>

    <UAlert
      v-else
      color="error"
      variant="subtle"
      :title="errorMessage || t('admin.storage.errors.generic')"
    />

    <ConfirmDialog
      v-model:open="purgeOpen"
      :title="t('admin.storage.purgeConfirmTitle')"
      :description="t('admin.storage.purgeConfirmDescription', { count: report?.pastes.reclaimable ?? 0, size: formatBytes(report?.bytes.reclaimable ?? 0) })"
      :confirm-label="t('admin.storage.purge')"
      :loading="purging"
      @confirm="purge"
    />
  </div>
</template>
