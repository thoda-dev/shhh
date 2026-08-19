<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

interface AllowedIp {
  id: string
  ip: string
  label: string | null
  createdAt: string
}

const ADMIN_ROLES = new Set(['admin', 'super_admin'])

const { t, locale } = useI18n()
const localePath = useLocalePath()

await ensureAuthSessionLoaded()
const user = useAuthUser()
if (!user.value || !ADMIN_ROLES.has(user.value.role)) {
  await navigateTo(localePath('/'))
}

const { data: allowedIps, refresh, status } = await useFetch<AllowedIp[]>('/api/admin/allowed-ips')

const schema = z.object({
  ip: z.union([z.ipv4(), z.ipv6()]),
  label: z.string().max(255).optional()
})
const state = reactive({ ip: '', label: '' })

const adding = ref(false)
const errorMessage = ref('')

async function add(event: FormSubmitEvent<z.output<typeof schema>>) {
  adding.value = true
  errorMessage.value = ''
  try {
    await $fetch('/api/admin/allowed-ips', {
      method: 'POST',
      body: { ip: event.data.ip, label: event.data.label || undefined }
    })
    state.ip = ''
    state.label = ''
    await refresh()
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.data?.message || t('admin.allowedIps.errors.generic')
  } finally {
    adding.value = false
  }
}

const removingId = ref<string | null>(null)
async function remove(id: string) {
  if (!confirm(t('admin.allowedIps.confirmDelete'))) return
  removingId.value = id
  try {
    await $fetch(`/api/admin/allowed-ips/${id}`, { method: 'DELETE' })
    await refresh()
  } finally {
    removingId.value = null
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(locale.value)
}
</script>

<template>
  <div class="mx-auto max-w-2xl p-4 pt-12">
    <div class="mb-2 flex items-center justify-between">
      <h1 class="text-xl font-semibold">{{ t('admin.allowedIps.title') }}</h1>
      <UButton variant="ghost" icon="i-lucide-arrow-left" :label="t('dashboard.backToCreate')" :to="localePath('/')" />
    </div>
    <div class="mb-6 flex flex-wrap gap-2">
      <UButton variant="ghost" size="sm" icon="i-lucide-settings" :label="t('admin.settings.title')" :to="localePath('/admin/settings')" />
      <UButton variant="ghost" size="sm" icon="i-lucide-shield" :label="t('admin.allowedIps.title')" :to="localePath('/admin/allowed-ips')" disabled />
      <UButton variant="ghost" size="sm" icon="i-lucide-ban" :label="t('admin.bannedIps.title')" :to="localePath('/admin/banned-ips')" />
      <UButton variant="ghost" size="sm" icon="i-lucide-users" :label="t('admin.users.title')" :to="localePath('/admin/users')" />
      <UButton variant="ghost" size="sm" icon="i-lucide-mail-plus" :label="t('admin.invitations.title')" :to="localePath('/admin/invitations')" />
    </div>

    <p class="mb-4 text-sm text-muted">{{ t('admin.allowedIps.description') }}</p>

    <UForm :schema="schema" :state="state" class="mb-6 max-w-sm space-y-3" @submit="add">
      <UFormField :label="t('admin.allowedIps.ipLabel')" name="ip">
        <UInput v-model="state.ip" :placeholder="t('admin.allowedIps.ipPlaceholder')" class="w-full" />
      </UFormField>
      <UFormField :label="t('admin.allowedIps.labelLabel')" name="label">
        <UInput v-model="state.label" :placeholder="t('admin.allowedIps.labelPlaceholder')" class="w-full" />
      </UFormField>
      <UButton type="submit" icon="i-lucide-plus" :loading="adding" :label="t('admin.allowedIps.add')" />
    </UForm>

    <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" class="mb-4" />

    <div v-if="status === 'pending'" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
    </div>

    <div v-else-if="!allowedIps?.length" class="py-12 text-center text-muted">
      {{ t('admin.allowedIps.empty') }}
    </div>

    <div v-else class="space-y-2">
      <UCard v-for="entry in allowedIps" :key="entry.id">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="font-mono text-sm">{{ entry.ip }}</p>
            <p class="text-xs text-muted">
              <span v-if="entry.label">{{ entry.label }} · </span>{{ t('admin.allowedIps.addedAt', { date: formatDate(entry.createdAt) }) }}
            </p>
          </div>
          <UButton color="error" variant="ghost" icon="i-lucide-trash-2" :loading="removingId === entry.id" @click="remove(entry.id)" />
        </div>
      </UCard>
    </div>
  </div>
</template>
