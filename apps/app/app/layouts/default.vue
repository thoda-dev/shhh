<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { t } = useI18n()
const localePath = useLocalePath()
const { appVersion } = useRuntimeConfig().public

// The anchors point at the landing page from anywhere, so the read and legal pages carry the same menu. Never shown as active: on `/` both would light up at once.
const links = computed<NavigationMenuItem[]>(() => [
  { label: t('landing.nav.howItWorks'), to: `${localePath('/')}#how-it-works`, active: false },
  { label: t('landing.nav.features'), to: `${localePath('/')}#features`, active: false },
  { label: t('nav.documentation'), to: 'https://shhh-docs.thoda.dev', target: '_blank' },
  { label: 'GitHub', to: 'https://github.com/thoda-dev/shhh', target: '_blank' }
])
</script>

<template>
  <div class="flex min-h-svh flex-col">
    <UHeader
      :to="localePath('/')"
      title="shhh"
    >
      <template #title>
        <AppLogo />
        <UBadge
          :label="`v${appVersion}`"
          color="neutral"
          variant="subtle"
          size="sm"
          class="font-mono"
        />
      </template>

      <UNavigationMenu
        :items="links"
        variant="link"
      />

      <template #right>
        <LanguageSwitcher />
        <UColorModeButton />
        <AuthButton class="hidden lg:flex" />
      </template>

      <template #body>
        <UNavigationMenu
          :items="links"
          orientation="vertical"
          class="-mx-2.5"
        />
        <USeparator class="my-6" />
        <AuthButton block />
      </template>
    </UHeader>

    <UMain class="flex flex-col">
      <slot />
    </UMain>

    <AppFooter />
  </div>
</template>
