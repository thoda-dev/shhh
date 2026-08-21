<script setup lang="ts">
const { t } = useI18n()

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
  // Absolute, not `/og-image.png`: every unfurler resolves it against nothing and needs the origin.
  ogImage: () => `${url.origin}/og-image.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: 'summary_large_image',
  twitterImage: () => `${url.origin}/og-image.png`,
  twitterTitle: t('seo.title'),
  twitterDescription: t('seo.description')
})

useHead({
  link: [{ rel: 'canonical', href: () => url.href }]
})
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <!-- Upstream project and its documentation, not the running instance: a fork is free to repoint
         both, but the links are attribution. "GitHub" stays out of i18n — a brand name reads the
         same in every locale — while "Documentation" does not. -->
    <div class="fixed top-4 left-4 z-50 flex items-center gap-1">
      <UButton
        variant="ghost"
        size="sm"
        icon="i-lucide-github"
        label="GitHub"
        href="https://github.com/thoda-dev/shhh"
        target="_blank"
        rel="noopener noreferrer"
      />
      <UButton
        variant="ghost"
        size="sm"
        icon="i-lucide-book-open"
        :label="$t('nav.documentation')"
        href="https://shhh-docs.thoda.dev"
        target="_blank"
        rel="noopener noreferrer"
      />
    </div>
    <div class="fixed top-4 right-4 z-50 flex items-center gap-2">
      <LanguageSwitcher />
      <UColorModeButton />
      <AuthButton />
    </div>
    <NuxtPage />
  </UApp>
</template>
