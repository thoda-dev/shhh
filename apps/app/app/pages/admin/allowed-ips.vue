<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'

interface AllowedIp {
  id: string
  ip: string
  label: string | null
  createdAt: string
}

definePageMeta({ layout: 'dashboard', middleware: 'auth', role: 'admin' })

const { t, locale } = useI18n()
const toast = useToast()

const { data: allowedIps, refresh, status } = await useFetch<AllowedIp[]>('/api/admin/allowed-ips', { default: () => [] })

const schema = z.object({
  ip: z.union([z.ipv4(), z.ipv6()]),
  label: z.string().max(255).optional()
})
const state = reactive({ ip: '', label: '' })

const adding = ref(false)

function showError(error: unknown) {
  const { statusMessage, message } = fetchErrorMessages(error)
  toast.add({ color: 'error', title: statusMessage || message || t('admin.allowedIps.errors.generic') })
}

async function add(event: FormSubmitEvent<z.output<typeof schema>>) {
  adding.value = true
  try {
    await $fetch('/api/admin/allowed-ips', {
      method: 'POST',
      body: { ip: event.data.ip, label: event.data.label || undefined }
    })
    state.ip = ''
    state.label = ''
    await refresh()
  } catch (error) {
    showError(error)
  } finally {
    adding.value = false
  }
}

const pendingRemove = ref<AllowedIp | null>(null)
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
    await $fetch(`/api/admin/allowed-ips/${pendingRemove.value.id}`, { method: 'DELETE' })
    await refresh()
  } catch (error) {
    showError(error)
  } finally {
    removing.value = false
    pendingRemove.value = null
  }
}

const columns = computed<TableColumn<AllowedIp>[]>(() => [
  { accessorKey: 'ip', header: t('admin.allowedIps.ipLabel') },
  { accessorKey: 'label', header: t('admin.allowedIps.labelLabel') },
  { accessorKey: 'createdAt', header: t('admin.allowedIps.columns.added'), meta: { class: { th: 'hidden md:table-cell', td: 'hidden md:table-cell' } } },
  { id: 'actions', meta: { class: { td: 'text-right' } } }
])

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value)
}
</script>

<template>
  <UDashboardPanel id="admin-allowed-ips">
    <template #header>
      <UDashboardNavbar :title="t('admin.allowedIps.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p class="text-sm text-muted">
        {{ t('admin.allowedIps.description') }}
      </p>

      <UPageCard variant="subtle">
        <UForm
          :schema="schema"
          :state="state"
          class="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          @submit="add"
        >
          <UFormField
            :label="t('admin.allowedIps.ipLabel')"
            name="ip"
          >
            <UInput
              v-model="state.ip"
              :placeholder="t('admin.allowedIps.ipPlaceholder')"
              class="w-full font-mono"
            />
          </UFormField>
          <UFormField
            :label="t('admin.allowedIps.labelLabel')"
            name="label"
          >
            <UInput
              v-model="state.label"
              :placeholder="t('admin.allowedIps.labelPlaceholder')"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            icon="i-lucide-plus"
            class="justify-center"
            :loading="adding"
            :label="t('admin.allowedIps.add')"
          />
        </UForm>
      </UPageCard>

      <UTable
        :data="allowedIps"
        :columns="columns"
        :loading="status === 'pending'"
        :empty="t('admin.allowedIps.empty')"
        class="shrink-0 rounded-lg border border-default"
        :ui="{ thead: 'bg-elevated/50', th: 'py-2', td: 'py-3' }"
      >
        <template #ip-cell="{ row }">
          <span class="font-mono break-all text-highlighted">{{ row.original.ip }}</span>
        </template>
        <template #label-cell="{ row }">
          <span class="text-muted">{{ row.original.label || '—' }}</span>
        </template>
        <template #createdAt-cell="{ row }">
          <span class="text-muted">{{ formatDate(row.original.createdAt) }}</span>
        </template>
        <template #actions-cell="{ row }">
          <UButton
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            :aria-label="t('admin.allowedIps.remove')"
            @click="pendingRemove = row.original"
          />
        </template>
      </UTable>

      <ConfirmDialog
        v-model:open="confirmOpen"
        :title="t('admin.allowedIps.remove')"
        :description="t('admin.allowedIps.confirmDelete')"
        :confirm-label="t('admin.allowedIps.remove')"
        :loading="removing"
        @confirm="remove"
      />
    </template>
  </UDashboardPanel>
</template>
