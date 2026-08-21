<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

await ensureAuthSessionLoaded()
const user = useAuthUser()
const isAuthenticated = computed(() => !!user.value)

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
    <UButton
      variant="ghost"
      size="sm"
      icon="i-lucide-user"
      :to="localePath('/account')"
      :aria-label="t('account.title')"
    />
    <UButton
      color="error"
      variant="subtle"
      size="sm"
      icon="i-lucide-log-out"
      :label="t('login.logout')"
      @click="logout"
    />
  </template>
  <UButton
    v-else
    color="primary"
    variant="subtle"
    size="sm"
    icon="i-lucide-log-in"
    :label="t('login.title')"
    :to="localePath('/login')"
  />
</template>
