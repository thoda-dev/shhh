<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <!-- Nine pages carry the same return path, and the label only fits next to a title from `sm` up. -->
  <UButton
    variant="ghost"
    icon="i-lucide-arrow-left"
    :aria-label="t('dashboard.backToCreate')"
    :to="localePath('/')"
    class="shrink-0"
  >
    <span class="hidden sm:inline">{{ t('dashboard.backToCreate') }}</span>
  </UButton>
</template>
