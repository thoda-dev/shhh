<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { t } = useI18n()
const localePath = useLocalePath()

await ensureAuthSessionLoaded()
const user = useAuthUser()
const isAuthenticated = computed(() => !!user.value)

// Signing up was only reachable from inside the login page, which hid it from anyone who has no account yet.
const publicSettings = await ensurePublicSettingsLoaded()
const canRegister = computed(() => publicSettings.value?.registrationEnabled === true)

// Everything an account can reach hangs off this one menu, so no page has to carry its own shortcut row.
const items = computed<DropdownMenuItem[]>(() => [
  { label: t('account.title'), icon: 'i-lucide-user', to: localePath('/account') },
  { label: t('dashboard.title'), icon: 'i-lucide-list', to: localePath('/dashboard') },
  // The whole admin area opens from its settings page, which an admin may enter as well as a super admin.
  ...(user.value && ['admin', 'super_admin'].includes(user.value.role)
    ? [{ label: t('admin.settings.title'), icon: 'i-lucide-settings', to: localePath('/admin/settings') }]
    : [])
])

async function logout() {
  // Better Auth's sign-out rejects with 415/400 unless given a real JSON body.
  await $fetch('/api/auth/sign-out', { method: 'POST', body: {} })
  await refreshAuthSession()
  // Bounces off pages that require auth; a no-op elsewhere, since / and /p/:id work fine anonymous.
  await navigateTo(localePath('/'))
}
</script>

<template>
  <template v-if="isAuthenticated">
    <UDropdownMenu :items="items">
      <UButton
        variant="ghost"
        size="sm"
        icon="i-lucide-user"
        trailing-icon="i-lucide-chevron-down"
        :aria-label="t('account.title')"
      />
    </UDropdownMenu>
    <UButton
      color="error"
      variant="subtle"
      size="sm"
      icon="i-lucide-log-out"
      :aria-label="t('login.logout')"
      @click="logout"
    >
      <span class="hidden sm:inline">{{ t('login.logout') }}</span>
    </UButton>
  </template>
  <template v-else>
    <UButton
      v-if="canRegister"
      variant="ghost"
      size="sm"
      icon="i-lucide-user-plus"
      :label="t('register.title')"
      :to="localePath('/register')"
    />
    <UButton
      color="primary"
      variant="subtle"
      size="sm"
      icon="i-lucide-log-in"
      :label="t('login.title')"
      :to="localePath('/login')"
    />
  </template>
</template>
