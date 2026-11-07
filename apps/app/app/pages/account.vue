<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const user = useAuthUser()

const publicSettings = await ensurePublicSettingsLoaded()
// With 2FA required, the account pages are all a non-enrolled account can reach, so they say why on every tab.
const mustEnrollNow = computed(() => publicSettings.value?.require2fa === true && !user.value?.twoFactorEnabled)

const links = computed<NavigationMenuItem[]>(() => [
  { label: t('account.tabs.general'), icon: 'i-lucide-user', to: localePath('/account'), exact: true },
  { label: t('account.tabs.security'), icon: 'i-lucide-shield', to: localePath('/account/security') }
])
</script>

<template>
  <UDashboardPanel
    id="account"
    :ui="{ body: 'lg:py-12' }"
  >
    <template #header>
      <UDashboardNavbar :title="t('account.title')">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <!-- `-mx-1` lines the first tab up with the collapse button above it. -->
        <UNavigationMenu
          :items="links"
          highlight
          class="-mx-1 flex-1"
        />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="mx-auto flex w-full flex-col gap-4 sm:gap-6 lg:max-w-2xl lg:gap-10">
        <UAlert
          v-if="mustEnrollNow"
          color="warning"
          variant="subtle"
          icon="i-lucide-shield-alert"
          :title="t('account.twoFactor.requiredTitle')"
          :description="t('account.twoFactor.requiredDescription')"
          :actions="[{ label: t('account.tabs.security'), to: localePath('/account/security'), color: 'warning', variant: 'outline' }]"
        />
        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>
