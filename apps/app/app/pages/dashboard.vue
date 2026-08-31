<script setup lang="ts">
interface PasteListItem {
  id: string
  kind: 'text' | 'file'
  passwordProtected: boolean
  maxReads: number | null
  readCount: number
  expiresAt: string
  createdAt: string
  fileMime: string | null
  fileSize: number | null
}

const { t, locale } = useI18n()
const localePath = useLocalePath()

await ensureAuthSessionLoaded()
const user = useAuthUser()
if (!user.value) {
  await navigateTo(localePath('/login'))
}

const { data: pastes, refresh, status } = await useFetch<PasteListItem[]>('/api/pastes')

const deletingId = ref<string | null>(null)
async function remove(id: string) {
  if (!confirm(t('dashboard.confirmDelete'))) return
  deletingId.value = id
  try {
    await $fetch(`/api/pastes/${id}`, { method: 'DELETE' })
    await refresh()
  } finally {
    deletingId.value = null
  }
}

function isExpired(paste: PasteListItem) {
  return new Date(paste.expiresAt).getTime() <= Date.now()
}
function isExhausted(paste: PasteListItem) {
  return paste.maxReads !== null && paste.readCount >= paste.maxReads
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value)
}
</script>

<template>
  <div class="mx-auto max-w-3xl p-4">
    <div class="mb-6 flex items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">
        {{ t('dashboard.title') }}
      </h1>
      <BackButton />
    </div>

    <div
      v-if="status === 'pending'"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-6 animate-spin"
      />
    </div>

    <div
      v-else-if="!pastes?.length"
      class="py-12 text-center text-muted"
    >
      {{ t('dashboard.empty') }}
    </div>

    <div
      v-else
      class="space-y-3"
    >
      <UCard
        v-for="paste in pastes"
        :key="paste.id"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex min-w-0 items-start gap-3">
            <UIcon
              :name="paste.kind === 'file' ? 'i-lucide-paperclip' : 'i-lucide-file-text'"
              class="mt-0.5 size-5 shrink-0 text-muted"
            />
            <div class="min-w-0">
              <!-- Four badges never fit one phone line, so they wrap under the kind instead of pushing the delete button off. -->
              <div class="flex flex-wrap items-center gap-2 text-sm">
                <span>{{ paste.kind === 'file' ? t('create.kindFile') : t('create.kindText') }}</span>
                <UBadge
                  v-if="paste.fileSize !== null"
                  variant="subtle"
                  color="neutral"
                  size="sm"
                >
                  {{ formatBytes(paste.fileSize) }}
                </UBadge>
                <UBadge
                  v-if="paste.passwordProtected"
                  variant="subtle"
                  color="neutral"
                  size="sm"
                  icon="i-lucide-lock"
                >
                  {{ t('dashboard.passwordProtected') }}
                </UBadge>
                <UBadge
                  v-if="isExpired(paste)"
                  variant="subtle"
                  color="error"
                  size="sm"
                >
                  {{ t('dashboard.statusExpired') }}
                </UBadge>
                <UBadge
                  v-else-if="isExhausted(paste)"
                  variant="subtle"
                  color="error"
                  size="sm"
                >
                  {{ t('dashboard.statusExhausted') }}
                </UBadge>
                <UBadge
                  v-else
                  variant="subtle"
                  color="success"
                  size="sm"
                >
                  {{ t('dashboard.statusActive') }}
                </UBadge>
              </div>
              <p class="mt-1 text-xs text-muted">
                {{ t('dashboard.created', { date: formatDate(paste.createdAt) }) }} ·
                {{ t('dashboard.expires', { date: formatDate(paste.expiresAt) }) }} ·
                {{ paste.maxReads === null ? t('dashboard.readsUnlimited', { count: paste.readCount }) : t('dashboard.reads', { count: paste.readCount, max: paste.maxReads }) }}
              </p>
            </div>
          </div>
          <UButton
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            class="shrink-0"
            :loading="deletingId === paste.id"
            @click="remove(paste.id)"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>
