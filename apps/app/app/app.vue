<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <!-- Upstream project, not the running instance: a fork is free to repoint it, but the link is
         attribution. The URL and the "GitHub" label are deliberately kept out of i18n — a brand
         name reads the same in every locale. -->
    <div class="fixed top-4 left-4 z-50">
      <UButton
        variant="ghost"
        size="sm"
        icon="i-lucide-github"
        label="GitHub"
        href="https://github.com/thoda-dev/shhh"
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
