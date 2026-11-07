<script setup lang="ts">
import type { TableColumn, TabsItem } from '@nuxt/ui'

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

type PasteStatus = 'active' | 'expired' | 'exhausted'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t, locale } = useI18n()
const localePath = useLocalePath()
const toast = useToast()

const { data: pastes, refresh, status } = await useFetch<PasteListItem[]>('/api/pastes', { default: () => [] })

// A reactive clock rather than `Date.now()`: a paste that expires while the page is open has to turn expired without a reload.
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => (clock = setInterval(() => (now.value = Date.now()), 30_000)))
onBeforeUnmount(() => clearInterval(clock))

function statusOf(paste: PasteListItem): PasteStatus {
  if (new Date(paste.expiresAt).getTime() <= now.value) return 'expired'
  if (paste.maxReads !== null && paste.readCount >= paste.maxReads) return 'exhausted'
  return 'active'
}

const STATUS_COLORS = { active: 'success', expired: 'neutral', exhausted: 'neutral' } as const

const DAY_MS = 24 * 60 * 60 * 1000

// Read off the list rather than a stats endpoint: the list is already the whole of what an account owns.
const stats = computed(() => {
  const all = pastes.value
  const active = all.filter(paste => statusOf(paste) === 'active')
  return [
    { key: 'active', icon: 'i-lucide-key-round', label: t('dashboard.stats.active'), value: active.length },
    { key: 'reads', icon: 'i-lucide-eye', label: t('dashboard.stats.reads'), value: all.reduce((sum, paste) => sum + paste.readCount, 0) },
    { key: 'expiring', icon: 'i-lucide-hourglass', label: t('dashboard.stats.expiringSoon'), value: active.filter(paste => new Date(paste.expiresAt).getTime() - now.value < DAY_MS).length },
    { key: 'ended', icon: 'i-lucide-archive', label: t('dashboard.stats.ended'), value: all.length - active.length }
  ]
})

const filter = ref<'all' | 'active' | 'ended'>('all')
const filterItems = computed<TabsItem[]>(() => [
  { label: t('dashboard.filters.all'), value: 'all' },
  { label: t('dashboard.filters.active'), value: 'active' },
  { label: t('dashboard.filters.ended'), value: 'ended' }
])

const rows = computed(() => pastes.value.filter((paste) => {
  if (filter.value === 'all') return true
  return (statusOf(paste) === 'active') === (filter.value === 'active')
}))

// Dates drop out first on a narrow screen: what a paste is, whether it still opens and its reads are what the row is for.
const columns = computed<TableColumn<PasteListItem>[]>(() => [
  { id: 'kind', header: t('dashboard.columns.paste') },
  { id: 'status', header: t('dashboard.columns.status') },
  { id: 'reads', header: t('dashboard.columns.reads') },
  { accessorKey: 'createdAt', header: t('dashboard.columns.created'), meta: { class: { th: 'hidden md:table-cell', td: 'hidden md:table-cell' } } },
  { accessorKey: 'expiresAt', header: t('dashboard.columns.expires'), meta: { class: { th: 'hidden sm:table-cell', td: 'hidden sm:table-cell' } } },
  { id: 'actions', meta: { class: { td: 'text-right' } } }
])

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value, { dateStyle: 'medium', timeStyle: 'short' })
}

const pendingDelete = ref<PasteListItem | null>(null)
const confirmOpen = computed({
  get: () => pendingDelete.value !== null,
  set: (value: boolean) => {
    if (!value) pendingDelete.value = null
  }
})
const deleting = ref(false)

async function remove() {
  if (!pendingDelete.value) return
  deleting.value = true
  try {
    await $fetch(`/api/pastes/${pendingDelete.value.id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ color: 'success', icon: 'i-lucide-trash-2', title: t('dashboard.deleted') })
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    toast.add({ color: 'error', title: statusMessage || message || t('dashboard.errors.delete') })
  } finally {
    deleting.value = false
    pendingDelete.value = null
  }
}
</script>

<template>
  <UDashboardPanel id="pastes">
    <template #header>
      <UDashboardNavbar :title="t('dashboard.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-plus"
            :label="t('dashboard.new')"
            :to="localePath('/dashboard/new')"
            :ui="{ label: 'hidden sm:inline' }"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPageGrid class="grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <UPageCard
          v-for="stat in stats"
          :key="stat.key"
          :icon="stat.icon"
          :title="stat.label"
          variant="subtle"
          :ui="{
            container: 'gap-y-1.5 p-4 sm:p-5',
            wrapper: 'items-start',
            leading: 'hidden sm:inline-flex p-2 rounded-full bg-primary/10 ring ring-inset ring-primary/25',
            leadingIcon: 'size-4',
            title: 'font-normal text-muted text-xs uppercase'
          }"
        >
          <span class="text-2xl font-semibold text-highlighted tabular-nums">{{ stat.value }}</span>
        </UPageCard>
      </UPageGrid>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <UTabs
          v-model="filter"
          :items="filterItems"
          :content="false"
          size="sm"
        />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-refresh-cw"
          :aria-label="t('dashboard.refresh')"
          :loading="status === 'pending'"
          @click="() => refresh()"
        />
      </div>

      <UTable
        :data="rows"
        :columns="columns"
        :loading="status === 'pending'"
        class="shrink-0 rounded-lg border border-default"
        :ui="{ thead: 'bg-elevated/50', th: 'py-2', td: 'py-3' }"
      >
        <template #kind-cell="{ row }">
          <div class="flex items-center gap-2.5">
            <UIcon
              :name="row.original.kind === 'file' ? 'i-lucide-paperclip' : 'i-lucide-file-text'"
              class="size-4 shrink-0 text-muted"
            />
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-highlighted">{{ row.original.kind === 'file' ? t('create.kindFile') : t('create.kindText') }}</span>
                <span
                  v-if="row.original.fileSize !== null"
                  class="text-xs text-muted"
                >{{ formatBytes(row.original.fileSize) }}</span>
                <UTooltip
                  v-if="row.original.passwordProtected"
                  :text="t('dashboard.passwordProtected')"
                >
                  <UIcon
                    name="i-lucide-lock"
                    class="size-3.5 text-muted"
                    :aria-label="t('dashboard.passwordProtected')"
                  />
                </UTooltip>
              </div>
              <!-- Stands in for the date columns a phone drops: without it, two text pastes with the same status and reads look identical. -->
              <p class="text-xs text-muted md:hidden">
                {{ t('dashboard.created', { date: formatDate(row.original.createdAt) }) }}
              </p>
            </div>
          </div>
        </template>

        <template #status-cell="{ row }">
          <UBadge
            :color="STATUS_COLORS[statusOf(row.original)]"
            variant="subtle"
            size="sm"
          >
            {{ t(`dashboard.status.${statusOf(row.original)}`) }}
          </UBadge>
        </template>

        <template #reads-cell="{ row }">
          <span class="tabular-nums">{{ row.original.readCount }}<span class="text-muted"> / {{ row.original.maxReads ?? '∞' }}</span></span>
        </template>

        <template #createdAt-cell="{ row }">
          <span class="text-muted">{{ formatDate(row.original.createdAt) }}</span>
        </template>

        <template #expiresAt-cell="{ row }">
          <span class="text-muted">{{ formatDate(row.original.expiresAt) }}</span>
        </template>

        <template #actions-cell="{ row }">
          <UButton
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            :aria-label="t('dashboard.delete')"
            @click="pendingDelete = row.original"
          />
        </template>

        <template #empty>
          <div class="flex flex-col items-center gap-3 py-10 text-center">
            <UIcon
              name="i-lucide-inbox"
              class="size-8 text-dimmed"
            />
            <p class="text-sm text-muted">
              {{ pastes.length ? t('dashboard.emptyFilter') : t('dashboard.empty') }}
            </p>
            <UButton
              v-if="!pastes.length"
              icon="i-lucide-plus"
              :label="t('dashboard.new')"
              :to="localePath('/dashboard/new')"
            />
          </div>
        </template>
      </UTable>

      <ConfirmDialog
        v-model:open="confirmOpen"
        :title="t('dashboard.confirmDeleteTitle')"
        :description="pendingDelete ? `${t('dashboard.created', { date: formatDate(pendingDelete.createdAt) })}. ${t('dashboard.confirmDelete')}` : ''"
        :confirm-label="t('dashboard.delete')"
        :loading="deleting"
        @confirm="remove"
      />
    </template>
  </UDashboardPanel>
</template>
