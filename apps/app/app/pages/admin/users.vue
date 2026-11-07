<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

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

const ROLE_OPTIONS: AdminUser['role'][] = ['user', 'admin', 'super_admin']

definePageMeta({ layout: 'dashboard', middleware: 'auth', role: 'admin' })

const { t, locale } = useI18n()
const toast = useToast()
const user = useAuthUser()
const isSuperAdmin = computed(() => user.value?.role === 'super_admin')

const { data: users, refresh, status } = await useFetch<AdminUser[]>('/api/admin/users', { default: () => [] })

function showError(error: unknown) {
  const { statusMessage, message } = fetchErrorMessages(error)
  toast.add({ color: 'error', title: statusMessage || message || t('admin.users.errors.generic') })
}

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
  try {
    await $fetch(`/api/admin/users/${target.id}`, { method: 'PATCH', body: { role } })
    await refresh()
  } catch (error) {
    showError(error)
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
  try {
    if (action.kind === 'account') {
      await $fetch(`/api/admin/users/${action.target.id}`, { method: 'DELETE' })
      toast.add({ color: 'success', icon: 'i-lucide-check', title: t('admin.users.result.accountDeleted', { email: action.target.email }) })
    } else {
      const { deletedCount } = await $fetch<{ deletedCount: number }>(`/api/admin/users/${action.target.id}/pastes`, {
        method: 'DELETE',
        query: { scope: action.scope }
      })
      toast.add({ color: 'success', icon: 'i-lucide-check', title: t('admin.users.result.pastesDeleted', { count: deletedCount, email: action.target.email }) })
    }
    pending.value = null
    await refresh()
  } catch (error) {
    showError(error)
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

const search = ref('')
const filteredUsers = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return users.value
  return users.value.filter(entry => entry.name.toLowerCase().includes(query) || entry.email.toLowerCase().includes(query))
})

const columns = computed<TableColumn<AdminUser>[]>(() => [
  { id: 'user', header: t('admin.users.columns.user') },
  { id: 'role', header: t('admin.users.columns.role') },
  { id: 'pastes', header: t('admin.users.columns.pastes'), meta: { class: { th: 'hidden sm:table-cell', td: 'hidden sm:table-cell' } } },
  { accessorKey: 'createdAt', header: t('admin.users.columns.joined'), meta: { class: { th: 'hidden md:table-cell', td: 'hidden md:table-cell' } } },
  { id: 'actions', meta: { class: { td: 'text-right' } } }
])
</script>

<template>
  <UDashboardPanel id="admin-users">
    <template #header>
      <UDashboardNavbar :title="t('admin.users.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #trailing>
          <UBadge
            :label="users.length"
            variant="subtle"
            color="neutral"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="!isSuperAdmin"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :title="t('admin.users.adminScopeNotice')"
      />

      <UInput
        v-model="search"
        icon="i-lucide-search"
        :placeholder="t('admin.users.search')"
        class="w-full sm:max-w-xs"
      />

      <UTable
        :data="filteredUsers"
        :columns="columns"
        :loading="status === 'pending'"
        class="shrink-0 rounded-lg border border-default"
        :ui="{ thead: 'bg-elevated/50', th: 'py-2', td: 'py-3' }"
      >
        <template #user-cell="{ row }">
          <UUser
            :name="row.original.name"
            :description="row.original.email"
            :avatar="{ text: (row.original.name || row.original.email).slice(0, 1).toUpperCase() }"
            :ui="{ description: 'break-all' }"
          >
            <template
              v-if="row.original.twoFactorEnabled"
              #name
            >
              <span class="inline-flex items-center gap-1.5">
                {{ row.original.name }}
                <UTooltip text="2FA">
                  <UIcon
                    name="i-lucide-shield-check"
                    class="size-3.5 text-success"
                    aria-label="2FA"
                  />
                </UTooltip>
              </span>
            </template>
          </UUser>
        </template>

        <template #role-cell="{ row }">
          <USelect
            v-if="canChangeRole(row.original)"
            :model-value="row.original.role"
            :items="ROLE_OPTIONS"
            size="sm"
            class="w-32"
            :loading="updatingId === row.original.id"
            @update:model-value="(role) => changeRole(row.original, role as AdminUser['role'])"
          />
          <UBadge
            v-else
            :color="roleColor[row.original.role]"
            variant="subtle"
            size="sm"
          >
            {{ row.original.role }}
          </UBadge>
        </template>

        <template #pastes-cell="{ row }">
          <span class="tabular-nums">{{ row.original.pastesCount }}</span>
          <span
            v-if="row.original.reclaimablePastesCount"
            class="text-xs text-muted"
          > · {{ t('admin.users.reclaimableShort', { count: row.original.reclaimablePastesCount }) }}</span>
        </template>

        <template #createdAt-cell="{ row }">
          <span class="text-muted">{{ formatDate(row.original.createdAt) }}</span>
        </template>

        <template #actions-cell="{ row }">
          <UDropdownMenu
            v-if="menuItems(row.original).length"
            :items="menuItems(row.original)"
            :content="{ align: 'end' }"
          >
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-ellipsis-vertical"
              :aria-label="t('admin.users.menu.label', { email: row.original.email })"
            />
          </UDropdownMenu>
        </template>
      </UTable>

      <ConfirmDialog
        v-model:open="confirmOpen"
        :title="confirmTitle"
        :description="confirmDescription"
        :confirm-label="t('admin.users.confirm.action')"
        :loading="acting"
        @confirm="runPending"
      />
    </template>
  </UDashboardPanel>
</template>
