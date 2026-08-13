<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <div class="fixed top-4 right-4 z-50 flex items-center gap-2">
      <LanguageSwitcher />
      <UColorModeButton />
      <AuthButton />
    </div>
    <NuxtPage />
  </UApp>
</template>
