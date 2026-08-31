<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

const settings = await ensurePublicSettingsLoaded()
const documents = computed(() => settings.value?.legalDocuments ?? [])
</script>

<template>
  <footer
    v-if="documents.length"
    class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pt-4 pb-6 text-xs text-muted"
  >
    <NuxtLink
      v-for="slug in documents"
      :key="slug"
      :to="localePath(`/legal/${slug}`)"
      class="hover:text-default"
    >
      {{ t(`legal.documents.${slug}`) }}
    </NuxtLink>
  </footer>
</template>
