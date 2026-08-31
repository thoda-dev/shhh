<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

interface BannedIp {
  id: string
  ip: string
  reason: string
  bannedAt: string
  expiresAt: string | null
}

const ADMIN_ROLES = new Set(['admin', 'super_admin'])

const { t, locale } = useI18n()
const localePath = useLocalePath()

await ensureAuthSessionLoaded()
const user = useAuthUser()
if (!user.value || !ADMIN_ROLES.has(user.value.role)) {
  await navigateTo(localePath('/'))
}

const { data: bannedIps, refresh, status } = await useFetch<BannedIp[]>('/api/admin/banned-ips')

const schema = z.object({
  ip: z.union([z.ipv4(), z.ipv6()]),
  reason: z.string().min(1).max(255)
})
const state = reactive({ ip: '', reason: '' })
const expiresInDays = ref<number | null>(null)

const adding = ref(false)
const errorMessage = ref('')

async function add(event: FormSubmitEvent<typeof state>) {
  adding.value = true
  errorMessage.value = ''
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
    const { statusMessage, message } = fetchErrorMessages(error)
    errorMessage.value = statusMessage || message || t('admin.bannedIps.errors.generic')
  } finally {
    adding.value = false
  }
}

const removingId = ref<string | null>(null)
async function remove(id: string) {
  if (!confirm(t('admin.bannedIps.confirmUnban'))) return
  removingId.value = id
  try {
    await $fetch(`/api/admin/banned-ips/${id}`, { method: 'DELETE' })
    await refresh()
  } finally {
    removingId.value = null
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value)
}
function isExpired(ip: BannedIp) {
  return ip.expiresAt !== null && new Date(ip.expiresAt).getTime() <= Date.now()
}
</script>

<template>
  <div class="mx-auto max-w-5xl p-4">
    <div class="mb-2 flex items-center justify-between">
      <h1 class="text-xl font-semibold">
        {{ t('admin.bannedIps.title') }}
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
      {{ t('admin.bannedIps.description') }}
    </p>

    <UForm
      :schema="schema"
      :state="state"
      class="mb-6 max-w-sm space-y-3"
      @submit="add"
    >
      <UFormField
        :label="t('admin.bannedIps.ipLabel')"
        name="ip"
      >
        <UInput
          v-model="state.ip"
          :placeholder="t('admin.bannedIps.ipPlaceholder')"
          class="w-full"
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
        icon="i-lucide-ban"
        :loading="adding"
        :label="t('admin.bannedIps.add')"
      />
    </UForm>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
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
      v-else-if="!bannedIps?.length"
      class="py-12 text-center text-muted"
    >
      {{ t('admin.bannedIps.empty') }}
    </div>

    <div
      v-else
      class="space-y-2"
    >
      <UCard
        v-for="entry in bannedIps"
        :key="entry.id"
      >
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <p class="font-mono text-sm">
                {{ entry.ip }}
              </p>
              <UBadge
                v-if="isExpired(entry)"
                variant="subtle"
                color="neutral"
                size="sm"
              >
                {{ t('admin.bannedIps.statusExpired') }}
              </UBadge>
              <UBadge
                v-else-if="entry.expiresAt === null"
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
                {{ t('admin.bannedIps.expiresAt', { date: formatDate(entry.expiresAt) }) }}
              </UBadge>
            </div>
            <p class="text-xs text-muted">
              {{ entry.reason }} · {{ t('admin.bannedIps.bannedAt', { date: formatDate(entry.bannedAt) }) }}
            </p>
          </div>
          <UButton
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            :loading="removingId === entry.id"
            @click="remove(entry.id)"
          />
        </div>
      </UCard>
    </div>
  </div>
</template>
