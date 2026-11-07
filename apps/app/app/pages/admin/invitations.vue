<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'

interface Invitation {
  id: string
  email: string
  state: 'pending' | 'accepted' | 'revoked' | 'expired'
  expiresAt: string
  createdAt: string
  acceptedAt: string | null
  invitedByEmail: string | null
}

const STATE_COLORS = {
  pending: 'info',
  accepted: 'success',
  revoked: 'neutral',
  expired: 'warning'
} as const

definePageMeta({ layout: 'dashboard', middleware: 'auth', role: 'admin' })

const { t, locale } = useI18n()
const toast = useToast()

const publicSettings = await ensurePublicSettingsLoaded()
const { data: invitations, refresh, status } = await useFetch<Invitation[]>('/api/admin/invitations', { default: () => [] })

const schema = z.object({ email: z.string().email() })
const state = reactive({ email: '' })

const inviting = ref(false)

async function invite(event: FormSubmitEvent<typeof state>) {
  inviting.value = true
  try {
    const created = await $fetch<{ sent: boolean }>('/api/admin/invitations', {
      method: 'POST',
      body: { email: event.data.email }
    })
    // The row is created even when delivery fails: say so plainly rather than claim success for an email nobody will receive.
    toast.add(created.sent
      ? { color: 'success', icon: 'i-lucide-send', title: t('admin.invitations.sent', { email: event.data.email }) }
      : { color: 'warning', icon: 'i-lucide-mail-x', title: t('admin.invitations.deliveryFailed'), description: t('admin.invitations.deliveryFailedHint'), duration: 0 })
    state.email = ''
    await refresh()
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    toast.add({ color: 'error', title: statusMessage || message || t('admin.invitations.errors.generic') })
  } finally {
    inviting.value = false
  }
}

const pendingRevoke = ref<Invitation | null>(null)
const confirmOpen = computed({
  get: () => pendingRevoke.value !== null,
  set: (value: boolean) => {
    if (!value) pendingRevoke.value = null
  }
})
const revoking = ref(false)

async function revoke() {
  if (!pendingRevoke.value) return
  revoking.value = true
  try {
    await $fetch(`/api/admin/invitations/${pendingRevoke.value.id}`, { method: 'DELETE' })
    await refresh()
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    toast.add({ color: 'error', title: statusMessage || message || t('admin.invitations.errors.generic') })
  } finally {
    revoking.value = false
    pendingRevoke.value = null
  }
}

const columns = computed<TableColumn<Invitation>[]>(() => [
  { accessorKey: 'email', header: t('admin.invitations.columns.email') },
  { accessorKey: 'state', header: t('admin.invitations.columns.state') },
  { id: 'details', header: t('admin.invitations.columns.details'), meta: { class: { th: 'hidden md:table-cell', td: 'hidden md:table-cell' } } },
  { id: 'actions', meta: { class: { td: 'text-right' } } }
])

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value)
}
</script>

<template>
  <UDashboardPanel id="admin-invitations">
    <template #header>
      <UDashboardNavbar :title="t('admin.invitations.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <p class="text-sm text-muted">
        {{ t('admin.invitations.description') }}
      </p>

      <UAlert
        v-if="publicSettings?.mailEnabled === false"
        color="warning"
        variant="subtle"
        icon="i-lucide-mail-x"
        :title="t('admin.invitations.mailDisabled')"
        :description="t('admin.invitations.mailDisabledHint')"
      />

      <UPageCard
        v-else
        variant="subtle"
      >
        <UForm
          :schema="schema"
          :state="state"
          class="flex flex-col gap-3 sm:flex-row sm:items-start"
          @submit="invite"
        >
          <UFormField
            name="email"
            class="flex-1"
          >
            <UInput
              v-model="state.email"
              type="email"
              icon="i-lucide-mail"
              :placeholder="t('admin.invitations.emailLabel')"
              :aria-label="t('admin.invitations.emailLabel')"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            icon="i-lucide-send"
            class="justify-center"
            :loading="inviting"
            :label="t('admin.invitations.send')"
          />
        </UForm>
      </UPageCard>

      <UTable
        :data="invitations"
        :columns="columns"
        :loading="status === 'pending'"
        :empty="t('admin.invitations.empty')"
        class="shrink-0 rounded-lg border border-default"
        :ui="{ thead: 'bg-elevated/50', th: 'py-2', td: 'py-3' }"
      >
        <template #email-cell="{ row }">
          <span class="break-all text-highlighted">{{ row.original.email }}</span>
        </template>

        <template #state-cell="{ row }">
          <UBadge
            :color="STATE_COLORS[row.original.state]"
            variant="subtle"
            size="sm"
          >
            {{ t(`admin.invitations.states.${row.original.state}`) }}
          </UBadge>
        </template>

        <template #details-cell="{ row }">
          <span class="text-muted">
            <span v-if="row.original.invitedByEmail">{{ t('admin.invitations.invitedBy', { email: row.original.invitedByEmail }) }} · </span>
            <span v-if="row.original.state === 'pending'">{{ t('admin.invitations.expiresAt', { date: formatDate(row.original.expiresAt) }) }}</span>
            <span v-else-if="row.original.acceptedAt">{{ t('admin.invitations.acceptedAt', { date: formatDate(row.original.acceptedAt) }) }}</span>
            <span v-else>{{ t('admin.invitations.createdAt', { date: formatDate(row.original.createdAt) }) }}</span>
          </span>
        </template>

        <template #actions-cell="{ row }">
          <UButton
            v-if="row.original.state === 'pending'"
            color="error"
            variant="ghost"
            icon="i-lucide-x"
            :aria-label="t('admin.invitations.revoke')"
            @click="pendingRevoke = row.original"
          />
        </template>
      </UTable>

      <ConfirmDialog
        v-model:open="confirmOpen"
        :title="t('admin.invitations.revoke')"
        :description="t('admin.invitations.confirmRevoke')"
        :confirm-label="t('admin.invitations.revoke')"
        :loading="revoking"
        @confirm="revoke"
      />
    </template>
  </UDashboardPanel>
</template>
