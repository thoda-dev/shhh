<script setup lang="ts">
import { en, fr } from '@nuxt/ui/locale'

const { t, locale } = useI18n()

// Nuxt UI carries its own strings (search, password toggle, empty table), which otherwise stay English.
const uiLocale = computed(() => ({ en, fr })[locale.value] ?? en)

// The instance's own address, so a shared link previews as itself rather than as whatever origin
// the build happened to know about. Read per request, which is what a crawler sees.
const url = useRequestURL()

// Set here rather than per page: every route describes the same product, and a paste page must
// stay deliberately silent — its title says nothing about the paste, and `Disallow: /p/` keeps
// crawlers away from it entirely.
useSeoMeta({
  title: t('seo.title'),
  description: t('seo.description'),
  ogTitle: t('seo.title'),
  ogDescription: t('seo.description'),
  ogType: 'website',
  ogSiteName: 'shhh',
  ogUrl: () => url.href,
  // No card image here: `pages/index.vue` adds one for the home page alone, so a shared paste link unfurls small instead of eating the conversation it lands in.
  twitterCard: 'summary',
  twitterTitle: t('seo.title'),
  twitterDescription: t('seo.description')
})

useHead({
  link: [{ rel: 'canonical', href: () => url.href }]
})
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLoadingIndicator color="var(--ui-primary)" />
    <NuxtRouteAnnouncer />
    <!-- Three shells: the public pages, the centred sign-in screens, and the dashboard. Each page names its own in `definePageMeta`. -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
