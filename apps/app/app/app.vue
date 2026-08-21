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
