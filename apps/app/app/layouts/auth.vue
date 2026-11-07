<script setup lang="ts">
const localePath = useLocalePath()
</script>

<template>
  <div class="relative flex min-h-svh flex-col">
    <div
      class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-linear-to-b from-primary/10 to-transparent"
      aria-hidden="true"
    />
    <header class="flex items-center justify-between gap-2 p-4">
      <ULink
        :to="localePath('/')"
        aria-label="shhh"
      >
        <AppLogo />
      </ULink>
      <div class="flex items-center gap-1">
        <LanguageSwitcher />
        <UColorModeButton />
      </div>
    </header>

    <main class="flex flex-1 items-center justify-center px-4 py-8">
      <slot />
    </main>

    <AppFooter />
  </div>
</template>
