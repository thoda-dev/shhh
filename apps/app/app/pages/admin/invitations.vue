<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

interface Invitation {
  id: string
  email: string
  state: 'pending' | 'accepted' | 'revoked' | 'expired'
  expiresAt: string
  createdAt: string
  acceptedAt: string | null
  invitedByEmail: string | null
}

const ADMIN_ROLES = new Set(['admin', 'super_admin'])

const STATE_COLORS = {
  pending: 'info',
  accepted: 'success',
  revoked: 'neutral',
  expired: 'warning'
} as const

const { t, locale } = useI18n()
const localePath = useLocalePath()

await ensureAuthSessionLoaded()
const user = useAuthUser()
if (!user.value || !ADMIN_ROLES.has(user.value.role)) {
  await navigateTo(localePath('/'))
}

const publicSettings = await ensurePublicSettingsLoaded()
const { data: invitations, refresh, status } = await useFetch<Invitation[]>('/api/admin/invitations')

const schema = z.object({ email: z.string().email() })
const state = reactive({ email: '' })

const inviting = ref(false)
const errorMessage = ref('')
const deliveryFailed = ref(false)

async function invite(event: FormSubmitEvent<typeof state>) {
  inviting.value = true
  errorMessage.value = ''
  deliveryFailed.value = false
  try {
    const created = await $fetch<{ sent: boolean }>('/api/admin/invitations', {
      method: 'POST',
      body: { email: event.data.email }
    })
    // The row is created even when delivery fails: say so plainly rather than claim success for an email nobody will receive.
    deliveryFailed.value = !created.sent
    state.email = ''
    await refresh()
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    errorMessage.value = statusMessage || message || t('admin.invitations.errors.generic')
  } finally {
    inviting.value = false
  }
}

const revokingId = ref<string | null>(null)
async function revoke(id: string) {
  if (!confirm(t('admin.invitations.confirmRevoke'))) return
  revokingId.value = id
  try {
    await $fetch(`/api/admin/invitations/${id}`, { method: 'DELETE' })
    await refresh()
  } finally {
    revokingId.value = null
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value)
}
</script>

<template>
  <div class="mx-auto max-w-2xl p-4 pt-12">
    <div class="mb-2 flex items-center justify-between">
      <h1 class="text-xl font-semibold">
        {{ t('admin.invitations.title') }}
      </h1>
      <UButton
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="t('dashboard.backToCreate')"
        :to="localePath('/')"
      />
    </div>
    <AdminNav />

    <p class="mb-4 text-sm text-muted">
      {{ t('admin.invitations.description') }}
    </p>

    <UAlert
      v-if="publicSettings?.mailEnabled === false"
      color="warning"
      variant="subtle"
      icon="i-lucide-mail-x"
      :title="t('admin.invitations.mailDisabled')"
      :description="t('admin.invitations.mailDisabledHint')"
      class="mb-6"
    />

    <UForm
      v-else
      :schema="schema"
      :state="state"
      class="mb-6 max-w-sm space-y-3"
      @submit="invite"
    >
      <UFormField
        :label="t('admin.invitations.emailLabel')"
        name="email"
      >
        <UInput
          v-model="state.email"
          type="email"
          class="w-full"
        />
      </UFormField>
      <UButton
        type="submit"
        icon="i-lucide-send"
        :loading="inviting"
        :label="t('admin.invitations.send')"
      />
    </UForm>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
      class="mb-4"
    />
    <UAlert
      v-if="deliveryFailed"
      color="warning"
      variant="subtle"
      :title="t('admin.invitations.deliveryFailed')"
      :description="t('admin.invitations.deliveryFailedHint')"
      class="mb-4"
    />

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
      v-else-if="!invitations?.length"
      class="py-12 text-center text-muted"
    >
      {{ t('admin.invitations.empty') }}
    </div>

    <div
      v-else
      class="space-y-2"
    >
      <UCard
        v-for="entry in invitations"
        :key="entry.id"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="truncate text-sm">
                {{ entry.email }}
              </p>
              <UBadge
                :color="STATE_COLORS[entry.state]"
                variant="subtle"
                size="sm"
              >
                {{ t(`admin.invitations.states.${entry.state}`) }}
              </UBadge>
            </div>
            <p class="text-xs text-muted">
              <span v-if="entry.invitedByEmail">{{ t('admin.invitations.invitedBy', { email: entry.invitedByEmail }) }} · </span>
              <span v-if="entry.state === 'pending'">{{ t('admin.invitations.expiresAt', { date: formatDate(entry.expiresAt) }) }}</span>
              <span v-else-if="entry.acceptedAt">{{ t('admin.invitations.acceptedAt', { date: formatDate(entry.acceptedAt) }) }}</span>
              <span v-else>{{ t('admin.invitations.createdAt', { date: formatDate(entry.createdAt) }) }}</span>
            </p>
          </div>
          <UButton
            v-if="entry.state === 'pending'"
            color="error"
            variant="ghost"
            icon="i-lucide-x"
            :loading="revokingId === entry.id"
            @click="revoke(entry.id)"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>
