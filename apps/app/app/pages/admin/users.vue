<script setup lang="ts">
interface AdminUser {
  id: string
  name: string
  email: string
  role: 'user' | 'admin' | 'super_admin'
  emailVerified: boolean
  twoFactorEnabled: boolean
  createdAt: string
  pastesCount: number
  reclaimablePastesCount: number
}

type PendingAction
  = | { kind: 'pastes', scope: 'reclaimable' | 'all', target: AdminUser }
    | { kind: 'account', target: AdminUser }

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
const resultMessage = ref('')

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
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    errorMessage.value = statusMessage || message || t('admin.users.errors.generic')
  } finally {
    updatingId.value = null
  }
}

// Every destructive action funnels through one pending slot, so the dialog has a single source of
// truth and two of them can never be armed at once.
const pending = ref<PendingAction | null>(null)
const acting = ref(false)

const confirmOpen = computed({
  get: () => pending.value !== null,
  set: (value: boolean) => {
    if (!value) pending.value = null
  }
})

const confirmTitle = computed(() => {
  const action = pending.value
  if (!action) return ''
  if (action.kind === 'account') return t('admin.users.confirm.accountTitle')
  return t(action.scope === 'all' ? 'admin.users.confirm.allPastesTitle' : 'admin.users.confirm.reclaimableTitle')
})

const confirmDescription = computed(() => {
  const action = pending.value
  if (!action) return ''
  const { email, pastesCount, reclaimablePastesCount } = action.target
  if (action.kind === 'account') return t('admin.users.confirm.accountDescription', { email, count: pastesCount })
  return action.scope === 'all'
    ? t('admin.users.confirm.allPastesDescription', { email, count: pastesCount })
    : t('admin.users.confirm.reclaimableDescription', { email, count: reclaimablePastesCount })
})

async function runPending() {
  const action = pending.value
  if (!action) return
  acting.value = true
  errorMessage.value = ''
  resultMessage.value = ''
  try {
    if (action.kind === 'account') {
      await $fetch(`/api/admin/users/${action.target.id}`, { method: 'DELETE' })
      resultMessage.value = t('admin.users.result.accountDeleted', { email: action.target.email })
    } else {
      const { deletedCount } = await $fetch<{ deletedCount: number }>(`/api/admin/users/${action.target.id}/pastes`, {
        method: 'DELETE',
        query: { scope: action.scope }
      })
      resultMessage.value = t('admin.users.result.pastesDeleted', { count: deletedCount, email: action.target.email })
    }
    pending.value = null
    await refresh()
  } catch (error) {
    const { statusMessage, message } = fetchErrorMessages(error)
    errorMessage.value = statusMessage || message || t('admin.users.errors.generic')
    pending.value = null
  } finally {
    acting.value = false
  }
}

function menuItems(target: AdminUser) {
  const groups = []
  // Paste deletion is super-admin only: an admin who may remove an account already cascades its
  // pastes, but one who may not has no business emptying it either.
  if (isSuperAdmin.value) {
    groups.push([
      {
        label: t('admin.users.menu.purgeReclaimable', { count: target.reclaimablePastesCount }),
        icon: 'i-lucide-trash-2',
        disabled: target.reclaimablePastesCount === 0,
        onSelect: () => (pending.value = { kind: 'pastes', scope: 'reclaimable', target })
      },
      {
        label: t('admin.users.menu.deleteAllPastes', { count: target.pastesCount }),
        icon: 'i-lucide-file-x',
        disabled: target.pastesCount === 0,
        onSelect: () => (pending.value = { kind: 'pastes', scope: 'all', target })
      }
    ])
  }
  if (canDelete(target)) {
    groups.push([
      {
        label: t('admin.users.menu.deleteAccount'),
        icon: 'i-lucide-user-x',
        color: 'error' as const,
        onSelect: () => (pending.value = { kind: 'account', target })
      }
    ])
  }
  return groups
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(locale.value)
}

const roleColor = { user: 'neutral', admin: 'info', super_admin: 'warning' } as const
</script>

<template>
  <div class="mx-auto max-w-5xl p-4">
    <div class="mb-2 flex items-center justify-between">
      <h1 class="text-xl font-semibold">
        {{ t('admin.users.title') }}
      </h1>
      <UButton
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="t('dashboard.backToCreate')"
        :to="localePath('/')"
      />
    </div>
    <AdminNav />

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
      class="mb-4"
    />
    <UAlert
      v-if="resultMessage"
      color="success"
      variant="subtle"
      :title="resultMessage"
      class="mb-4"
    />
    <UAlert
      v-if="!isSuperAdmin"
      color="info"
      variant="subtle"
      :title="t('admin.users.adminScopeNotice')"
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
      v-else
      class="space-y-2"
    >
      <UCard
        v-for="target in users"
        :key="target.id"
      >
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium">
                {{ target.name }}
              </p>
              <UBadge
                :color="roleColor[target.role]"
                variant="subtle"
                size="sm"
              >
                {{ target.role }}
              </UBadge>
              <UBadge
                v-if="target.twoFactorEnabled"
                variant="subtle"
                color="success"
                size="sm"
                icon="i-lucide-shield-check"
              >
                2FA
              </UBadge>
            </div>
            <p class="text-xs text-muted">
              {{ target.email }} · {{ t('admin.users.joined', { date: formatDate(target.createdAt) }) }} ·
              {{ t('admin.users.pastesSummary', { count: target.pastesCount, reclaimable: target.reclaimablePastesCount }) }}
            </p>
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
            <UDropdownMenu
              v-if="menuItems(target).length"
              :items="menuItems(target)"
            >
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-ellipsis-vertical"
                :aria-label="t('admin.users.menu.label', { email: target.email })"
              />
            </UDropdownMenu>
          </div>
        </div>
      </UCard>
    </div>

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="confirmTitle"
      :description="confirmDescription"
      :confirm-label="t('admin.users.confirm.action')"
      :loading="acting"
      @confirm="runPending"
    />
  </div>
</template>
