<script setup lang="ts">
interface AdminLink {
  to: string
  icon: string
  label: string
  superAdminOnly?: boolean
}

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const user = useAuthUser()

const links = computed(() => {
  const all: AdminLink[] = [
    { to: '/admin/settings', icon: 'i-lucide-settings', label: t('admin.settings.title') },
    { to: '/admin/storage', icon: 'i-lucide-hard-drive', label: t('admin.storage.title'), superAdminOnly: true },
    { to: '/admin/allowed-ips', icon: 'i-lucide-shield', label: t('admin.allowedIps.title') },
    { to: '/admin/banned-ips', icon: 'i-lucide-ban', label: t('admin.bannedIps.title') },
    { to: '/admin/users', icon: 'i-lucide-users', label: t('admin.users.title') },
    { to: '/admin/invitations', icon: 'i-lucide-mail-plus', label: t('admin.invitations.title') },
    { to: '/admin/legal', icon: 'i-lucide-scale', label: t('admin.legal.title'), superAdminOnly: true }
  ]
  return all.filter(link => !link.superAdminOnly || user.value?.role === 'super_admin')
})
</script>

<template>
  <div class="mb-6 flex flex-wrap gap-2">
    <UButton
      v-for="link in links"
      :key="link.to"
      variant="ghost"
      size="sm"
      :icon="link.icon"
      :label="link.label"
      :to="localePath(link.to)"
      :disabled="route.path === localePath(link.to)"
    />
  </div>
</template>
