<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'

interface BannedIp {
  id: string
  ip: string
  reason: string
  bannedAt: string
  expiresAt: string | null
}

definePageMeta({ layout: 'dashboard', middleware: 'auth', role: 'admin' })

const { t, locale } = useI18n()
const toast = useToast()

const { data: bannedIps, refresh, status } = await useFetch<BannedIp[]>('/api/admin/banned-ips', { default: () => [] })

const schema = z.object({
  ip: z.union([z.ipv4(), z.ipv6()]),
  reason: z.string().min(1).max(255)
})
const state = reactive({ ip: '', reason: '' })
const expiresInDays = ref<number | null>(null)

const adding = ref(false)

function showError(error: unknown) {
  const { statusMessage, message } = fetchErrorMessages(error)
  toast.add({ color: 'error', title: statusMessage || message || t('admin.bannedIps.errors.generic') })
}

async function add(event: FormSubmitEvent<typeof state>) {
  adding.value = true
  try {
    const expiresAt = expiresInDays.value ? new Date(Date.now() + expiresInDays.value * 24 * 60 * 60 * 1000).toISOString() : null
    await $fetch('/api/admin/banned-ips', {
      method: 'POST',
      body: { ip: event.data.ip, reason: event.data.reason, expiresAt }
    })
    state.ip = ''
    state.reason = ''
    expiresInDays.value = null
    await refresh()
  } catch (error) {
    showError(error)
  } finally {
    adding.value = false
  }
}

const pendingRemove = ref<BannedIp | null>(null)
const confirmOpen = computed({
  get: () => pendingRemove.value !== null,
  set: (value: boolean) => {
    if (!value) pendingRemove.value = null
  }
})
const removing = ref(false)

async function remove() {
  if (!pendingRemove.value) return
  removing.value = true
  try {
    await $fetch(`/api/admin/banned-ips/${pendingRemove.value.id}`, { method: 'DELETE' })
    await refresh()
  } catch (error) {
    showError(error)
  } finally {
    removing.value = false
    pendingRemove.value = null
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value)
}
function isExpired(ip: BannedIp) {
  return ip.expiresAt !== null && new Date(ip.expiresAt).getTime() <= Date.now()
}

const columns = computed<TableColumn<BannedIp>[]>(() => [
  { accessorKey: 'ip', header: t('admin.bannedIps.ipLabel') },
  { id: 'status', header: t('admin.bannedIps.columns.status') },
  { accessorKey: 'reason', header: t('admin.bannedIps.reasonLabel'), meta: { class: { th: 'hidden sm:table-cell', td: 'hidden sm:table-cell' } } },
  { accessorKey: 'bannedAt', header: t('admin.bannedIps.columns.banned'), meta: { class: { th: 'hidden md:table-cell', td: 'hidden md:table-cell' } } },
  { id: 'actions', meta: { class: { td: 'text-right' } } }
])
</script>

<template>
  <UDashboardPanel id="admin-banned-ips">
    <template #header>
      <UDashboardNavbar :title="t('admin.bannedIps.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p class="text-sm text-muted">
        {{ t('admin.bannedIps.description') }}
      </p>

      <UPageCard variant="subtle">
        <UForm
          :schema="schema"
          :state="state"
          class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1.5fr_10rem_auto] lg:items-end"
          @submit="add"
        >
          <UFormField
            :label="t('admin.bannedIps.ipLabel')"
            name="ip"
          >
            <UInput
              v-model="state.ip"
              :placeholder="t('admin.bannedIps.ipPlaceholder')"
              class="w-full font-mono"
            />
          </UFormField>
          <UFormField
            :label="t('admin.bannedIps.reasonLabel')"
            name="reason"
          >
            <UInput
              v-model="state.reason"
              :placeholder="t('admin.bannedIps.reasonPlaceholder')"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="t('admin.bannedIps.expiresInDays')">
            <UInput
              v-model.number="expiresInDays"
              type="number"
              min="1"
              :placeholder="t('admin.bannedIps.permanent')"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            color="error"
            icon="i-lucide-ban"
            class="justify-center"
            :loading="adding"
            :label="t('admin.bannedIps.add')"
          />
        </UForm>
      </UPageCard>

      <UTable
        :data="bannedIps"
        :columns="columns"
        :loading="status === 'pending'"
        :empty="t('admin.bannedIps.empty')"
        class="shrink-0 rounded-lg border border-default"
        :ui="{ thead: 'bg-elevated/50', th: 'py-2', td: 'py-3' }"
      >
        <template #ip-cell="{ row }">
          <span class="font-mono break-all text-highlighted">{{ row.original.ip }}</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge
            v-if="isExpired(row.original)"
            variant="subtle"
            color="neutral"
            size="sm"
          >
            {{ t('admin.bannedIps.statusExpired') }}
          </UBadge>
          <UBadge
            v-else-if="row.original.expiresAt === null"
            variant="subtle"
            color="error"
            size="sm"
          >
            {{ t('admin.bannedIps.permanent') }}
          </UBadge>
          <UBadge
            v-else
            variant="subtle"
            color="warning"
            size="sm"
          >
            {{ t('admin.bannedIps.expiresAt', { date: formatDate(row.original.expiresAt) }) }}
          </UBadge>
        </template>
        <template #reason-cell="{ row }">
          <span class="text-muted">{{ row.original.reason }}</span>
        </template>
        <template #bannedAt-cell="{ row }">
          <span class="text-muted">{{ formatDate(row.original.bannedAt) }}</span>
        </template>
        <template #actions-cell="{ row }">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-undo-2"
            :aria-label="t('admin.bannedIps.unban')"
            @click="pendingRemove = row.original"
          />
        </template>
      </UTable>

      <ConfirmDialog
        v-model:open="confirmOpen"
        :title="t('admin.bannedIps.unban')"
        :description="t('admin.bannedIps.confirmUnban')"
        :confirm-label="t('admin.bannedIps.unban')"
        :loading="removing"
        @confirm="remove"
      />
    </template>
  </UDashboardPanel>
</template>
