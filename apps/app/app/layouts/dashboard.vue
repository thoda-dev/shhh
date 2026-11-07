<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n()
const localePath = useLocalePath()
const user = useAuthUser()

const isAdmin = computed(() => isAdminRole(user.value?.role))
const isSuperAdmin = computed(() => user.value?.role === 'super_admin')

const mainLinks = computed<NavigationMenuItem[]>(() => [
  { label: t('dashboard.new'), icon: 'i-lucide-plus', to: localePath('/dashboard/new') },
  { label: t('dashboard.title'), icon: 'i-lucide-key-round', to: localePath('/dashboard'), exact: true },
  { label: t('account.title'), icon: 'i-lucide-user', to: localePath('/account') }
])

// Same split as the server: storage and the legal pages are the super admin's alone.
const adminLinks = computed<NavigationMenuItem[]>(() => {
  if (!isAdmin.value) return []
  const links: (NavigationMenuItem & { superAdminOnly?: boolean })[] = [
    { label: t('admin.settings.title'), icon: 'i-lucide-settings', to: localePath('/admin/settings') },
    { label: t('admin.storage.title'), icon: 'i-lucide-hard-drive', to: localePath('/admin/storage'), superAdminOnly: true },
    { label: t('admin.users.title'), icon: 'i-lucide-users', to: localePath('/admin/users') },
    { label: t('admin.invitations.title'), icon: 'i-lucide-mail-plus', to: localePath('/admin/invitations') },
    { label: t('admin.allowedIps.title'), icon: 'i-lucide-shield-check', to: localePath('/admin/allowed-ips') },
    { label: t('admin.bannedIps.title'), icon: 'i-lucide-ban', to: localePath('/admin/banned-ips') },
    { label: t('admin.legal.title'), icon: 'i-lucide-scale', to: localePath('/admin/legal'), superAdminOnly: true }
  ]
  return [
    { label: t('nav.administration'), type: 'label' },
    ...links.filter(link => !link.superAdminOnly || isSuperAdmin.value).map(({ superAdminOnly: _, ...link }) => link)
  ]
})

const footerLinks = computed<NavigationMenuItem[]>(() => [
  { label: t('nav.home'), icon: 'i-lucide-house', to: localePath('/') },
  { label: t('nav.documentation'), icon: 'i-lucide-book-open', to: 'https://shhh-docs.thoda.dev', target: '_blank' }
])

const searchGroups = computed(() => [{
  id: 'links',
  label: t('nav.goTo'),
  items: [...mainLinks.value, ...adminLinks.value.filter(link => link.type !== 'label'), ...footerLinks.value]
    .map(({ label, icon, to, target }) => ({ label, icon, to, target }))
}])
</script>

<template>
  <UDashboardGroup
    unit="rem"
    storage-key="shhh_dashboard"
  >
    <UDashboardSidebar
      id="default"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <ULink
          :to="localePath('/')"
          aria-label="shhh"
          class="flex items-center"
          :class="collapsed ? 'mx-auto' : 'px-1.5'"
        >
          <AppLogo :icon-only="collapsed" />
        </ULink>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton
          :collapsed="collapsed"
          class="bg-transparent ring-default"
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="mainLinks"
          orientation="vertical"
          tooltip
        />

        <UNavigationMenu
          v-if="adminLinks.length"
          :collapsed="collapsed"
          :items="adminLinks"
          orientation="vertical"
          tooltip
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="footerLinks"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="searchGroups" />

    <slot />
  </UDashboardGroup>
</template>
