<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{
  collapsed?: boolean
}>()

const { t, locale, locales, setLocale } = useI18n()
const localePath = useLocalePath()
const colorMode = useColorMode()
const user = useAuthUser()

type LocaleCode = typeof locale.value

const avatar = computed(() => ({ text: (user.value?.name || user.value?.email || '?').slice(0, 1).toUpperCase() }))

async function logout() {
  // Better Auth's sign-out rejects with 415/400 unless given a real JSON body.
  await $fetch('/api/auth/sign-out', { method: 'POST', body: {} })
  await refreshAuthSession()
  await navigateTo(localePath('/'))
}

const items = computed<DropdownMenuItem[][]>(() => [
  [{ type: 'label', label: user.value?.name, description: user.value?.email, avatar: avatar.value }],
  [
    { label: t('account.tabs.general'), icon: 'i-lucide-user', to: localePath('/account') },
    { label: t('account.tabs.security'), icon: 'i-lucide-shield', to: localePath('/account/security') }
  ],
  [
    {
      label: t('nav.appearance'),
      icon: 'i-lucide-sun-moon',
      children: (['system', 'light', 'dark'] as const).map(mode => ({
        label: t(`nav.colorMode.${mode}`),
        icon: { system: 'i-lucide-monitor', light: 'i-lucide-sun', dark: 'i-lucide-moon' }[mode],
        type: 'checkbox' as const,
        checked: colorMode.preference === mode,
        onSelect: (event: Event) => {
          event.preventDefault()
          colorMode.preference = mode
        }
      }))
    },
    {
      label: t('nav.language'),
      icon: 'i-lucide-languages',
      children: locales.value.map(entry => ({
        label: entry.name ?? entry.code,
        type: 'checkbox' as const,
        checked: entry.code === locale.value,
        onSelect: () => setLocale(entry.code as LocaleCode)
      }))
    }
  ],
  [{ label: t('login.logout'), icon: 'i-lucide-log-out', color: 'error' as const, onSelect: logout }]
])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-56' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      :avatar="avatar"
      :label="collapsed ? undefined : user?.name"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{ trailingIcon: 'text-dimmed', label: 'truncate' }"
    />
  </UDropdownMenu>
</template>
