<script setup lang="ts">
interface AdminUser {
  id: string
  name: string
  email: string
  role: 'user' | 'admin' | 'super_admin'
  emailVerified: boolean
  twoFactorEnabled: boolean
  createdAt: string
}

const ADMIN_ROLES = new Set(['admin', 'super_admin'])
const ROLE_OPTIONS: AdminUser['role'][] = ['user', 'admin', 'super_admin']

const { t, locale } = useI18n()
const localePath = useLocalePath()

await ensureAuthSessionLoaded()
const user = useAuthUser()
if (!user.value || !ADMIN_ROLES.has(user.value.role)) {
  await navigateTo(localePath('/'))
}
const isSuperAdmin = computed(() => user.value?.role === 'super_admin')

const { data: users, refresh, status } = await useFetch<AdminUser[]>('/api/admin/users')

const errorMessage = ref('')

function canDelete(target: AdminUser) {
  if (!user.value || target.id === user.value.id) return false
  if (user.value.role === 'admin') return target.role === 'user'
  return true
}

function canChangeRole(target: AdminUser) {
  return isSuperAdmin.value && target.id !== user.value?.id
}

const updatingId = ref<string | null>(null)
async function changeRole(target: AdminUser, role: AdminUser['role']) {
  updatingId.value = target.id
  errorMessage.value = ''
  try {
    await $fetch(`/api/admin/users/${target.id}`, { method: 'PATCH', body: { role } })
    await refresh()
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.data?.message || t('admin.users.errors.generic')
  } finally {
    updatingId.value = null
  }
}

const removingId = ref<string | null>(null)
async function remove(target: AdminUser) {
  if (!confirm(t('admin.users.confirmDelete', { email: target.email }))) return
  removingId.value = target.id
  errorMessage.value = ''
  try {
    await $fetch(`/api/admin/users/${target.id}`, { method: 'DELETE' })
    await refresh()
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.data?.message || t('admin.users.errors.generic')
  } finally {
    removingId.value = null
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(locale.value)
}

const roleColor = { user: 'neutral', admin: 'info', super_admin: 'warning' } as const
</script>

<template>
  <div class="mx-auto max-w-3xl p-4 pt-12">
    <div class="mb-2 flex items-center justify-between">
      <h1 class="text-xl font-semibold">{{ t('admin.users.title') }}</h1>
      <UButton variant="ghost" icon="i-lucide-arrow-left" :label="t('dashboard.backToCreate')" :to="localePath('/')" />
    </div>
    <div class="mb-6 flex flex-wrap gap-2">
      <UButton variant="ghost" size="sm" icon="i-lucide-settings" :label="t('admin.settings.title')" :to="localePath('/admin/settings')" />
      <UButton variant="ghost" size="sm" icon="i-lucide-shield" :label="t('admin.allowedIps.title')" :to="localePath('/admin/allowed-ips')" />
      <UButton variant="ghost" size="sm" icon="i-lucide-ban" :label="t('admin.bannedIps.title')" :to="localePath('/admin/banned-ips')" />
      <UButton variant="ghost" size="sm" icon="i-lucide-users" :label="t('admin.users.title')" :to="localePath('/admin/users')" disabled />
      <UButton variant="ghost" size="sm" icon="i-lucide-mail-plus" :label="t('admin.invitations.title')" :to="localePath('/admin/invitations')" />
    </div>

    <UAlert v-if="errorMessage" color="error" variant="subtle" :title="errorMessage" class="mb-4" />
    <UAlert v-if="!isSuperAdmin" color="info" variant="subtle" :title="t('admin.users.adminScopeNotice')" class="mb-4" />

    <div v-if="status === 'pending'" class="flex justify-center py-12">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
    </div>

    <div v-else class="space-y-2">
      <UCard v-for="target in users" :key="target.id">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium">{{ target.name }}</p>
              <UBadge :color="roleColor[target.role]" variant="subtle" size="sm">{{ target.role }}</UBadge>
              <UBadge v-if="target.twoFactorEnabled" variant="subtle" color="success" size="sm" icon="i-lucide-shield-check">2FA</UBadge>
            </div>
            <p class="text-xs text-muted">{{ target.email }} · {{ t('admin.users.joined', { date: formatDate(target.createdAt) }) }}</p>
          </div>
          <div class="flex items-center gap-2">
            <USelect
              v-if="canChangeRole(target)"
              :model-value="target.role"
              :items="ROLE_OPTIONS"
              size="sm"
              class="w-36"
              :loading="updatingId === target.id"
              @update:model-value="(role) => changeRole(target, role as AdminUser['role'])"
            />
            <UButton
              v-if="canDelete(target)"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              :loading="removingId === target.id"
              @click="remove(target)"
            />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
